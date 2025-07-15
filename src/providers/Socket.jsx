import React, { useMemo, useEffect } from "react";
import { io } from "socket.io-client";

const SocketContext = React.createContext(null);

export const useSocket = () => {
    const socket = React.useContext(SocketContext);
    if (!socket) {
        throw new Error("useSocket must be used within a SocketProvider");
    }
    return socket;
};

export const SocketProvider = (props) => {
    const socket = useMemo(
        () =>
            io("https://webrtc-server-cczj.onrender.com", {
                transports: ["websocket", "polling"],
                withCredentials: true,
            }),
        []
    );

    useEffect(() => {
        socket.on("connect", () => {
            console.log("Socket connected:", socket.id);
        });
        socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err.message);
        });
        socket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
        });

        return () => {
            socket.off("connect");
            socket.off("connect_error");
            socket.off("disconnect");
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={socket}>
            {props.children}
        </SocketContext.Provider>
    );
};
