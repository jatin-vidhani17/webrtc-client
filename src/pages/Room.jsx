import React, { useEffect, useCallback, useState, useRef } from "react";
import "../index.css";
import { useSocket } from "../providers/Socket";
import { usePeer } from "../providers/Peer";
import { Video, Mic, VideoOff, MicOff, Monitor } from "lucide-react";

const RoomPage = () => {
    const socket = useSocket();
    const { peer, createOffer, createAnswer, setRemoteAns, sendStream, remoteStream } = usePeer();
    const [myStream, setMyStream] = useState(null);
    const [remoteEmailId, setRemoteEmailId] = useState(null);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isAudioOn, setIsAudioOn] = useState(true);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [connectionState, setConnectionState] = useState("disconnected");
    const [error, setError] = useState(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const handleNewUserJoined = useCallback(
        async (data) => {
            const { emailId } = data;
            console.log("New User Joined Room:", emailId);
            setRemoteEmailId(emailId);
            if (peer.signalingState === "stable") {
                try {
                    const offer = await createOffer();
                    socket.emit("call-user", { emailId, offer });
                } catch (err) {
                    console.error("Error creating offer:", err);
                    setError("Failed to initiate call");
                }
            } else {
                console.warn("Peer not in stable state, delaying offer");
            }
        },
        [createOffer, socket, peer]
    );

    const handleIncomingCall = useCallback(
        async (data) => {
            const { from, offer } = data;
            console.log("Incoming Call from:", from, offer);
            setRemoteEmailId(from);
            try {
                const ans = await createAnswer(offer);
                socket.emit("call-accepted", { emailId: from, ans });
                if (myStream) {
                    await sendStream(myStream);
                } else {
                    console.warn("No local stream available to send");
                }
            } catch (err) {
                console.error("Error handling incoming call:", err);
                setError("Failed to accept call");
            }
        },
        [createAnswer, socket, myStream, sendStream]
    );

    const handleCallAccepted = useCallback(
        async (data) => {
            const { ans } = data;
            console.log("Call Accepted with answer:", ans);
            try {
                await setRemoteAns(ans);
                if (myStream) {
                    await sendStream(myStream);
                } else {
                    console.warn("No local stream available to send");
                }
            } catch (err) {
                console.error("Error handling call accepted:", err);
                setError("Failed to set call answer");
            }
        },
        [setRemoteAns, sendStream, myStream]
    );

    const handleUserDisconnected = useCallback(
        (data) => {
            const { emailId } = data;
            console.log("User Disconnected:", emailId);
            if (emailId === remoteEmailId) {
                setRemoteEmailId(null);
                setConnectionState("disconnected");
            }
        },
        [remoteEmailId]
    );

    const getUserMediaStream = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setMyStream(stream);
            console.log("Local stream acquired:", stream.getTracks());
            await sendStream(stream);
        } catch (error) {
            console.error("Error accessing media devices:", error);
            setError(
                error.name === "NotAllowedError"
                    ? "Please grant camera and microphone permissions"
                    : "Unable to access media devices"
            );
        }
    }, [sendStream]);

    const handleNegotiationNeeded = useCallback(async () => {
        if (remoteEmailId) {
            try {
                const offer = await createOffer();
                socket.emit("call-user", { emailId: remoteEmailId, offer });
                console.log("Negotiation needed, offer sent to:", remoteEmailId);
            } catch (err) {
                console.error("Error during negotiation:", err);
                setError("Failed to renegotiate connection");
            }
        }
    }, [peer, remoteEmailId, socket, createOffer]);

    const toggleVideo = useCallback(() => {
        if (myStream) {
            const videoTrack = myStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !isVideoOn;
                console.log("Video track enabled:", videoTrack.enabled);
                setIsVideoOn(!isVideoOn);
            }
        }
    }, [myStream, isVideoOn]);

    const toggleAudio = useCallback(() => {
        if (myStream) {
            const audioTrack = myStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !isAudioOn;
                console.log("Audio track enabled:", audioTrack.enabled);
                setIsAudioOn(!isAudioOn);
            }
        }
    }, [myStream, isAudioOn]);

    const toggleScreenShare = useCallback(async () => {
        if (isScreenSharing) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setMyStream(stream);
                await sendStream(stream);
                setIsScreenSharing(false);
            } catch (err) {
                console.error("Error switching to camera:", err);
                setError("Failed to switch back to camera");
            }
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                setMyStream(stream);
                await sendStream(stream);
                setIsScreenSharing(true);
                stream.getVideoTracks()[0].onended = async () => {
                    try {
                        const newStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                        setMyStream(newStream);
                        await sendStream(newStream);
                        setIsScreenSharing(false);
                    } catch (err) {
                        console.error("Error restoring camera after screen share:", err);
                        setError("Failed to restore camera");
                    }
                };
            } catch (error) {
                console.error("Error starting screen share:", error);
                setError("Failed to start screen sharing");
            }
        }
    }, [isScreenSharing, sendStream]);

    useEffect(() => {
        const handleConnectionStateChange = () => {
            console.log("Connection state:", peer.connectionState);
            setConnectionState(peer.connectionState);
        };

        peer.addEventListener("negotiationneeded", handleNegotiationNeeded);
        peer.addEventListener("connectionstatechange", handleConnectionStateChange);
        return () => {
            peer.removeEventListener("negotiationneeded", handleNegotiationNeeded);
            peer.removeEventListener("connectionstatechange", handleConnectionStateChange);
        };
    }, [handleNegotiationNeeded, peer]);

    useEffect(() => {
        socket.on("user-joined", handleNewUserJoined);
        socket.on("incoming-call", handleIncomingCall);
        socket.on("call-accepted", handleCallAccepted);
        socket.on("user-disconnected", handleUserDisconnected);

        return () => {
            socket.off("user-joined", handleNewUserJoined);
            socket.off("incoming-call", handleIncomingCall);
            socket.off("call-accepted", handleCallAccepted);
            socket.off("user-disconnected", handleUserDisconnected);
        };
    }, [handleNewUserJoined, handleIncomingCall, handleCallAccepted, handleUserDisconnected, socket]);

    useEffect(() => {
        getUserMediaStream();
    }, [getUserMediaStream]);

    useEffect(() => {
        if (localVideoRef.current && myStream) {
            localVideoRef.current.srcObject = myStream;
            console.log("Local video updated:", myStream.getTracks());
        }
    }, [myStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            console.log("Remote video updated:", remoteStream.getTracks());
        }
    }, [remoteStream]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold">Error</h1>
                    <p>{error}</p>
                    <button
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={() => window.location.reload()}
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-center p-2 sm:p-4 font-sans backdrop-blur-sm">
            <div className="w-full max-w-6xl bg-gray-850 bg-opacity-90 rounded-2xl shadow-2xl flex flex-col h-[85vh] overflow-hidden border border-gray-700">
                <div className="p-4 border-b border-gray-600">
                    <h1 className="text-xl sm:text-2xl font-semibold text-white">Video Meeting</h1>
                    <p className="text-sm text-gray-300">
                        {remoteEmailId ? `With: ${remoteEmailId} (${connectionState})` : "Waiting for participants..."}
                    </p>
                </div>
                <div className="flex-1 p-4 sm:p-6 overflow-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
                        <div className="relative w-full max-w-[360px] sm:max-w-[400px] aspect-video bg-gray-900 rounded-xl overflow-hidden mx-auto transition-transform duration-200 hover:scale-105 hover:shadow-lg">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
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
                        <div className="relative w-full max-w-[360px] sm:max-w-[400px] aspect-video bg-gray-900 rounded-xl overflow-hidden mx-auto transition-transform duration-200 hover:scale-105 hover:shadow-lg">
                            {remoteStream ? (
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    className="w-full h-full object-cover rounded-xl"
                                    aria-label="Remote video stream"
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    {remoteEmailId ? "Waiting for remote stream..." : "No remote user"}
                                </div>
                            )}
                            {remoteEmailId && (
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                                    <span className="text-sm text-white font-medium">{remoteEmailId}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-gray-900 bg-opacity-90 flex justify-center items-center space-x-3 sm:space-x-4">
                    <button
                        onClick={toggleVideo}
                        disabled={!myStream}
                        className={`p-2 sm:p-3 rounded-full transition-all duration-200 ${
                            isVideoOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
                        } text-white`}
                        aria-label={isVideoOn ? "Turn off video" : "Turn on video"}
                        title={isVideoOn ? "Turn off video" : "Turn on video"}
                    >
                        {isVideoOn ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <button
                        onClick={toggleAudio}
                        disabled={!myStream}
                        className={`p-2 sm:p-3 rounded-full transition-all duration-200 ${
                            isAudioOn ? "bg-gray-700 hover:bg-gray-600" : "bg-red-600 hover:bg-red-700"
                        } text-white`}
                        aria-label={isAudioOn ? "Turn off audio" : "Turn on audio"}
                        title={isAudioOn ? "Turn off audio" : "Turn on audio"}
                    >
                        {isAudioOn ? <Mic className="w-4 h-4 sm:w-5 sm:h-5" /> : <MicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                    <button
                        onClick={toggleScreenShare}
                        disabled={!myStream}
                        className={`p-2 sm:p-3 rounded-full transition-all duration-200 ${
                            isScreenSharing ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 hover:bg-gray-600"
                        } text-white`}
                        aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
                        title={isScreenSharing ? "Stop sharing screen" : "Share screen"}
                    >
                        <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                    <button
                        onClick={() => {
                            if (myStream && connectionState === "connected") {
                                sendStream(myStream);
                                console.log("Stream sent:", myStream.getTracks());
                            } else {
                                console.warn("Cannot send stream: No stream or not connected");
                            }
                        }}
                        disabled={!myStream || connectionState !== "connected"}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold text-white transition-all duration-200 ${
                            myStream && connectionState === "connected" ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-600 cursor-not-allowed"
                        }`}
                        aria-label="Send video stream"
                        title="Send video stream"
                    >
                        Send Video
                    </button>
                </div>
                <div className="p-2 bg-gray-850 text-xs sm:text-sm text-gray-300 flex justify-between border-t border-gray-600">
                    <span>
                        My Stream:{" "}
                        {myStream ? (
                            <span className="text-green-400">Active ({myStream.getTracks().length} tracks)</span>
                        ) : (
                            <span className="text-red-400">Inactive</span>
                        )}
                    </span>
                    <span>
                        Remote Stream:{" "}
                        {remoteStream ? (
                            <span className="text-green-400">Active ({remoteStream.getTracks().length} tracks)</span>
                        ) : (
                            <span className="text-red-400">Inactive</span>
                        )}
                    </span>
                    <span>
                        Connection: <span className={connectionState === "connected" ? "text-green-400" : "text-red-400"}>{connectionState}</span>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default RoomPage;
