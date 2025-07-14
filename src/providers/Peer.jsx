import React,{useMemo,useEffect,useState, useCallback} from "react";

const PeerContext = React.createContext(null);

export const usePeer = () => {
    const peer = React.useContext(PeerContext);
    if (!peer) {
        throw new Error('usePeer must be used within a PeerProvider');
    }
    return peer;
}

export const PeerProvider = (props) => {  
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
    }

    const createAnswer = async(offer) =>{
        await peer.setRemoteDescription(offer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        return answer;
    }

    const setRemoteAns = async (ans) => {
        await peer.setRemoteDescription(ans);
    };

 const sendStream = async (stream) => {
        if (streamAddedRef.current) {
            console.warn("Stream already added to peer. Skipping.");
            return;
        }

        try {
            const tracks = stream.getTracks();
            for (const track of tracks) {
                peer.addTrack(track, stream);
            }
            streamAddedRef.current = true;
        } catch (err) {
            console.error("Error adding stream:", err);
        }
    };

    const handleTrackEvent = useCallback((event) => {
        const streams = event.streams;
        setRemoteStream(streams[0]);
    }, [setRemoteStream]);

    useEffect(() => {
        peer.addEventListener('track', handleTrackEvent);
        return () => {
            peer.removeEventListener('track', handleTrackEvent);
        };
    }, [handleTrackEvent,peer]);

    return (
        <PeerContext.Provider value={{peer, createOffer,createAnswer, setRemoteAns,sendStream, remoteStream}}>
            {props.children}
        </PeerContext.Provider>
    );
};