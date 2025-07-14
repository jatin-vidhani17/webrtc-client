import React, { useMemo, useEffect, useState, useCallback } from "react";
import { useSocket } from "./Socket";

const PeerContext = React.createContext(null);

export const usePeer = () => {
    const peer = React.useContext(PeerContext);
    if (!peer) {
        throw new Error('usePeer must be used within a PeerProvider');
    }
    return peer;
};

export const PeerProvider = (props) => {
    const socket = useSocket();
    const [remoteStream, setRemoteStream] = useState(null);
    const peer = useMemo(() => new RTCPeerConnection({
        iceServers: [
            {
                urls: [
                    "stun:stun.l.google.com:19302",
                    "stun:global.stun.twilio.com:3478",
                ]
            }
        ],
    }), []);

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
        if (peer.connectionState !== 'connected' && peer.connectionState !== 'stable') {
            console.warn("Peer connection not ready:", peer.connectionState);
            return;
        }
        try {
            // Remove existing tracks to avoid duplicates
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
            console.error("Error adding stream:", err);
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

    const handleIceCandidate = useCallback((event) => {
        if (event.candidate) {
            console.log("ICE candidate generated:", event.candidate);
            socket.emit('ice-candidate', { candidate: event.candidate });
        }
    }, [socket]);

    const handleReceiveIceCandidate = useCallback(
        (data) => {
            try {
                peer.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log("ICE candidate added:", data.candidate);
            } catch (err) {
                console.error("Error adding ICE candidate:", err);
            }
        },
        [peer]
    );

    useEffect(() => {
        peer.addEventListener('track', handleTrackEvent);
        peer.addEventListener('icecandidate', handleIceCandidate);
        socket.on('ice-candidate', handleReceiveIceCandidate);

        return () => {
            peer.removeEventListener('track', handleTrackEvent);
            peer.removeEventListener('icecandidate', handleIceCandidate);
            socket.off('ice-candidate', handleReceiveIceCandidate);
        };
    }, [handleTrackEvent, handleIceCandidate, handleReceiveIceCandidate, peer, socket]);

    return (
        <PeerContext.Provider value={{ peer, createOffer, createAnswer, setRemoteAns, sendStream, remoteStream }}>
            {props.children}
        </PeerContext.Provider>
    );
};
