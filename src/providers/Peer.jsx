import React, { useMemo, useEffect, useState, useCallback } from "react";
import { useSocket } from "./Socket"; // Import useSocket to emit ICE candidates

const PeerContext = React.createContext(null);

export const usePeer = () => {
    const peer = React.useContext(PeerContext);
    if (!peer) {
        throw new Error('usePeer must be used within a PeerProvider');
    }
    return peer;
};

export const PeerProvider = (props) => {
    const socket = useSocket(); // Get socket instance
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
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        return offer;
    };

    const createAnswer = async (offer) => {
        await peer.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        return answer;
    };

    const setRemoteAns = async (ans) => {
        await peer.setRemoteDescription(new RTCSessionDescription(ans));
    };

    const sendStream = async (stream) => {
        try {
            const tracks = stream.getTracks();
            for (const track of tracks) {
                peer.addTrack(track, stream);
            }
        } catch (err) {
            console.error("Error adding stream:", err);
        }
    };

    const handleTrackEvent = useCallback((event) => {
        const streams = event.streams;
        if (streams[0]) {
            setRemoteStream(streams[0]);
        }
    }, []);

    // Handle ICE candidates
    const handleIceCandidate = useCallback((event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', { candidate: event.candidate });
        }
    }, [socket]);

    // Receive ICE candidates
    const handleReceiveIceCandidate = useCallback((data) => {
        peer.addIceCandidate(new RTCIceCandidate(data.candidate)).catch((err) => {
            console.error("Error adding ICE candidate:", err);
        });
    }, [peer]);

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
