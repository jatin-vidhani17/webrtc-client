import React, { useEffect, useCallback, useState } from "react";
import "../index.css";
import { useSocket } from "../providers/Socket";
import { usePeer } from "../providers/Peer";
import { Video, Mic, VideoOff, MicOff, Monitor } from 'lucide-react';

const RoomPage = () => {
    const socket = useSocket();
    const { peer, createOffer, createAnswer, setRemoteAns, sendStream, remoteStream } = usePeer();

    const [myStream, setMyStream] = useState(null);
    const [remoteEmailId, setRemoteEmailId] = useState(null);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const handleNewUserJoined = useCallback(
        async (data) => {
            const { emailId } = data;
            console.log("New User Joined Room: ", emailId);
            const offer = await createOffer();
            socket.emit('call-user', { emailId, offer });
            setRemoteEmailId(emailId);
        },
        [createOffer, socket]
    );

    const handleIncomingCall = useCallback(async (data) => {
        const { from, offer } = data;
        console.log("Incoming Call from", from, offer);
        const ans = await createAnswer(offer);
        socket.emit('call-accepted', { emailId: from, ans });
        setRemoteEmailId(from);
    }, [createAnswer, socket]);

    const handleCallAccepted = useCallback(async (data) => {
        const { ans } = data;
        console.log("Call Accepted with answer: ", ans);
        await setRemoteAns(ans);
    }, [setRemoteAns]);

    const getUserMediaStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setMyStream(stream);
        } catch (error) {
            console.error("Error accessing media devices:", error);
        }
    }, []);

    const handleNegotiationNeeded = useCallback(async () => {
        const localOffer = peer.localDescription;
        socket.emit('call-user', { emailId: remoteEmailId, offer: localOffer });
    }, [peer.localDescription, remoteEmailId, socket]);

    const toggleVideo = useCallback(() => {
        if (myStream) {
            myStream.getVideoTracks()[0].enabled = !isVideoOn;
            setIsVideoOn(!isVideoOn);
        }
    }, [myStream, isVideoOn]);

    const toggleAudio = useCallback(() => {
        if (myStream) {
            myStream.getAudioTracks()[0].enabled = !isAudioOn;
            setIsAudioOn(!isAudioOn);
        }
    }, [myStream, isAudioOn]);

    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setMyStream(stream);
            sendStream(stream);
            setIsScreenSharing(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setMyStream(stream);
                sendStream(stream);
                setIsScreenSharing(true);
                stream.getVideoTracks()[0].onended = () => {
                    getUserMediaStream();
                    setIsScreenSharing(false);
                };
            } catch (error) {
                console.error("Error starting screen share:", error);
            }
        }
    }, [isScreenSharing, getUserMediaStream, sendStream]);

    useEffect(() => {
        socket.on("user-joined", handleNewUserJoined);
        socket.on('incomming-call', handleIncomingCall);
        socket.on("call-accepted", handleCallAccepted);

        return () => {
            socket.off("user-joined", handleNewUserJoined);
            socket.off("incomming-call", handleIncomingCall);
            socket.off("call-accepted", handleCallAccepted);
        };
    }, [handleNewUserJoined, handleIncomingCall, handleCallAccepted, socket]);

    useEffect(() => {
        peer.addEventListener('negotiationneeded', handleNegotiationNeeded);
        return () => {
            peer.removeEventListener('negotiationneeded', handleNegotiationNeeded);
        };
    }, [handleNegotiationNeeded, peer]);

    useEffect(() => {
        getUserMediaStream();
    }, [getUserMediaStream]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-2 sm:p-4 font-sans backdrop-blur-sm">
            <div className="w-full max-w-6xl bg-gray-850 bg-opacity-90 rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden border border-gray-700">
                {/* Header */}
                <div className="p-4 border-b border-gray-600">
                    <h1 className="text-xl sm:text-2xl font-semibold text-white">Video Meeting</h1>
                    <p className="text-sm text-gray-300">{remoteEmailId ? `With: ${remoteEmailId}` : "Waiting for participants..."}</p>
                </div>

                {/* Video Grid */}
                <div className="flex-1 p-4 sm:p-6 overflow-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
                        <div className="relative w-full max-w-[360px] sm:max-w-[400px] aspect-video bg-gray-900 rounded-xl overflow-hidden mx-auto transition-transform duration-200 hover:scale-105 hover:shadow-lg">
                            <video
                                autoPlay
                                muted
                                ref={(video) => {
                                    if (video && myStream) {
                                        video.srcObject = myStream;
                                    }
                                }}
                                className="w-full h-full object-cover rounded-xl"
                                aria-label="Your video stream"
                            />
                            {!isVideoOn && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 rounded-xl">
                                    <VideoOff className="text-red-400 w-8 h-8" />
                                </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                                <span className="text-sm text-white font-medium">
                                    You {isScreenSharing ? "(Screen Sharing)" : ""}
                                </span>
                            </div>
                        </div>
                        {remoteStream && (
                            <div className="relative w-full max-w-[360px] sm:max-w-[400px] aspect-video bg-gray-900 rounded-xl overflow-hidden mx-auto transition-transform duration-200 hover:scale-105 hover:shadow-lg">
                                <video
                                    autoPlay
                                    ref={(video) => {
                                        if (video && remoteStream) {
                                            video.srcObject = remoteStream;
                                        }
                                    }}
                                    className="w-full h-full object-cover rounded-xl"
                                    aria-label="Remote video stream"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                                    <span className="text-sm text-white font-medium">
                                        {remoteEmailId}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Control Bar */}
                <div className="p-4 bg-gray-900 bg-opacity-90 flex justify-center items-center space-x-3 sm:space-x-4">
                    <button
                        onClick={toggleVideo}
                        disabled={!myStream}
                        className={`p-2 sm:p-3 rounded-full transition-all duration-200 ${isVideoOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} text-white`}
                        aria-label={isVideoOn ? "Turn off video" : "Turn on video"}
                        title={isVideoOn ? "Turn off video" : "Turn on video"}
                    >
                        {isVideoOn ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <button
                        onClick={toggleAudio}
                        disabled={!myStream}
                        className={`p-2 sm:p-3 rounded-full transition-all duration-200 ${isAudioOn ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'} text-white`}
                        aria-label={isAudioOn ? "Turn off audio" : "Turn on audio"}
                        title={isAudioOn ? "Turn off audio" : "Turn on audio"}
                    >
                        {isAudioOn ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <button
                        onClick={toggleScreenShare}
                        disabled={!myStream}
                        className={`p-2 sm:p-3 rounded-full transition-all duration-200 ${isScreenSharing ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'} text-white`}
                        aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
                        title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
                    >
                        <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                        onClick={() => sendStream(myStream)}
                        disabled={!myStream}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-white transition-all duration-200 ${myStream ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 cursor-not-allowed'}`}
                        aria-label="Send video stream"
                        title="Send video stream"
                    >
                        Send Video
                    </button>
                </div>

                {/* Status Bar */}
                <div className="p-2 bg-gray-850 text-xs sm:text-sm text-gray-300 flex justify-between border-t border-gray-600">
                    <span>My Stream: {myStream ? <span className="text-green-400">Active</span> : <span className="text-red-400">Inactive</span>}</span>
                    <span>Remote Stream: {remoteStream ? <span className="text-green-400">Active</span> : <span className="text-red-400">Inactive</span>}</span>
                </div>
            </div>
        </div>
    );
}

export default RoomPage;