import React, { useMemo, useEffect, useState, useCallback } from "react";
import { useSocket } from "./Socket";

const PeerContext = React.createContext(null);

export const usePeer = () => {
    const peer = React.useContext(PeerContext);
    if (!peer) {
        throw new Error("usePeer must be used within a PeerProvider");
    }
    return peer;
};

export const PeerProvider = (props) => {
    const socket = useSocket();
    const [remoteStream, setRemoteStream] = useState(null);
    const pendingIceCandidates = useMemo(() => [], []);

    const peer = useMemo(
        () =>
            new RTCPeerConnection({
                iceServers: [
                    {
                        urls: [
                            "stun:stun.l.google.com:19302",
                            "stun:global.stun.twilio.com:3478",
                        ],
                    },
                    {
                        urls: [
                            "turn:openrelay.metered.ca:80",
                            "turn:openrelay.metered.ca:443",
                        ],
                        username: "openrelayproject",
                        credential: "openrelayproject",
                    },
                ],
            }),
        []
    );

    const createOffer = async () => {
        try {
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            console.log("Offer created:", offer);
            return offer;
        } catch (err) {
            console.error("Error creating offer:", err);
            throw err;
        }
    };

    const createAnswer = async (offer) => {
        try {
            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            console.log("Answer created:", answer);
            return answer;
        } catch (err) {
            console.error("Error creating answer:", err);
            throw err;
        }
    };

    const setRemoteAns = async (ans) => {
        try {
            await peer.setRemoteDescription(new RTCSessionDescription(ans));
            console.log("Remote answer set");
        } catch (err) {
            console.error("Error setting remote answer:", err);
            throw err;
        }
    };

    const sendStream = async (stream) => {
        if (!stream) {
            console.warn("No stream provided to sendStream");
            return;
        }
        if (peer.connectionState !== "connected" && peer.connectionState !== "stable") {
            console.warn("Peer connection not ready:", peer.connectionState);
            return;
        }
        try {
            const senders = peer.getSenders();
            for (const sender of senders) {
                peer.removeTrack(sender);
            }
            const tracks = stream.getTracks();
            for (const track of tracks) {
                peer.addTrack(track, stream);
                console.log("Track added:", track.kind, track.id);
            }
        } catch (err) {
            console.error("Error sending stream:", err);
        }
    };

    const handleTrackEvent = useCallback((event) => {
        const streams = event.streams;
        if (streams[0]) {
            console.log("Received remote stream with tracks:", streams[0].getTracks());
            setRemoteStream(streams[0]);
        } else {
            console.warn("No streams in track event");
        }
    }, []);

    const handleIceCandidate = useCallback(
        (event) => {
            if (event.candidate) {
                console.log("ICE candidate generated:", event.candidate.candidate);
                socket.emit("ice-candidate", { candidate: event.candidate });
            }
        },
        [socket]
    );

    const handleReceiveIceCandidate = useCallback(
        async (data) => {
            try {
                if (peer.remoteDescription) {
                    await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
                    console.log("ICE candidate added:", data.candidate.candidate);
                } else {
                    pendingIceCandidates.push(data.candidate);
                    console.log("Buffered ICE candidate:", data.candidate.candidate);
                }
            } catch (err) {
                console.error("Error adding ICE candidate:", err);
            }
        },
        [peer]
    );

    const handleIceConnectionStateChange = useCallback(() => {
        console.log("ICE connection state:", peer.iceConnectionState);
    }, [peer]);

    useEffect(() => {
        const applyPendingCandidates = async () => {
            if (peer.remoteDescription && pendingIceCandidates.length > 0) {
                for (const candidate of pendingIceCandidates) {
                    try {
                        await peer.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log("Applied buffered ICE candidate:", candidate.candidate);
                    } catch (err) {
                        console.error("Error applying buffered ICE candidate:", err);
                    }
                }
                pendingIceCandidates.length = 0;
            }
        };

        peer.addEventListener("track", handleTrackEvent);
        peer.addEventListener("icecandidate", handleIceCandidate);
        peer.addEventListener("signalingstatechange", applyPendingCandidates);
        peer.addEventListener("iceconnectionstatechange", handleIceConnectionStateChange);
        socket.on("ice-candidate", handleReceiveIceCandidate);

        return () => {
            peer.removeEventListener("track", handleTrackEvent);
            peer.removeEventListener("icecandidate", handleIceCandidate);
            peer.removeEventListener("signalingstatechange", applyPendingCandidates);
            peer.removeEventListener("iceconnectionstatechange", handleIceConnectionStateChange);
            socket.off("ice-candidate", handleReceiveIceCandidate);
        };
    }, [handleTrackEvent, handleIceCandidate, handleReceiveIceCandidate, handleIceConnectionStateChange, peer, socket]);

    return (
        <PeerContext.Provider value={{ peer, createOffer, createAnswer, setRemoteAns, sendStream, remoteStream }}>
            {props.children}
        </PeerContext.Provider>
    );
};
