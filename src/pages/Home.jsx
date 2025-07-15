import React, { useState, useEffect, useCallback } from "react";
import { useSocket } from "../providers/Socket";
import { useNavigate } from "react-router-dom";

const Homepage = () => {
    const socket = useSocket();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [roomId, setRoomId] = useState("");

    const handleRoomJoined = useCallback(
        ({ roomId }) => {
            console.log("Joined room:", roomId);
            navigate(`/room/${roomId}`);
        },
        [navigate]
    );

    useEffect(() => {
        socket.on("joined-room", handleRoomJoined);

        return () => {
            socket.off("joined-room", handleRoomJoined);
        };
    }, [handleRoomJoined, socket]);

    const handleJoinRoom = () => {
        if (!email || !roomId) {
            alert("Please enter both email and room ID");
            return;
        }
        socket.emit("join-room", {
            roomId,
            emailId: email,
        });
    };

    return (
        <div className="homepage-container">
            <div className="input-container">
                <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="Enter your email"
                />
                <input
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    type="text"
                    placeholder="Enter your room code"
                />
                <button onClick={handleJoinRoom}>Enter Room</button>
            </div>
        </div>
    );
};

export default Homepage;
