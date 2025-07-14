import React,{ useState,useEffect,useCallback } from "react";
import {useSocket} from "../providers/Socket";
import { useNavigate } from "react-router-dom";

const Homepage = () =>{
    
    const socket = useSocket();
    const navigate = useNavigate();
    const[email,setEmail] = useState("");
    const[roomId,setRoomId] = useState("");
    
    const handleRoomJoined = useCallback(({roomId}) => {
        navigate(`/room/${roomId}`);
    },[navigate]);
    
    useEffect(() => {
        socket.on("joined-room", handleRoomJoined);

        // socket.on("user-joined", (data) => {
        //     console.log("User Joined:", data.emailId);
        // });

        return () => {
            socket.off("joined-room",handleRoomJoined);
            socket.off("user-joined");
        };
    }, [handleRoomJoined,socket]);

    const handleJoinRoom = () => {
        socket.emit("join-room",{
            roomId,
            emailId: email
        });
    }
    return(
        <div className="homepage-container">
            <div className="input-container">
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Enter your email " />
                <input value={roomId} onChange={e => setRoomId(e.target.value)} type="text" placeholder="Enter your roomcode " />
                <button onClick={handleJoinRoom}> Enter Room  </button>
            </div>
        </div>
    );
}
export default Homepage;