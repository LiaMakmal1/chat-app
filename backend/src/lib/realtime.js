//  handle real-time chat, track who's online, and send updates

import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express(); 
const server = http.createServer(app); // create an HTTP server using Express



const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
    credentials: true,
  },
  // Add security options
  maxHttpBufferSize: 1e6, // 1MB max buffer size
  pingTimeout: 60000,
  pingInterval: 25000,
});

export function userSocketId(userId) {
  return socketMap[userId];
}

// track online users
const socketMap = {}; // {userId: socketId}
const active_users = new Set(); // another way to track users

io.on("connection", (socket) => {  // handle new client connections
  console.log("user connected", socket.id);

  const userId = socket.handshake.query.userId;

  // Validate userId before storing
  if (userId && typeof userId === "string" && userId.match(/^[0-9a-fA-F]{24}$/)) {
    socketMap[userId] = socket.id;

    // Limit concurrent connections per user
    const userCon = Object.values(socketMap).filter(id => id === socket.id).length;
    if (userCon > 3) {
      socket.emit("error", "Looks like you are connected in multiple places. Please disconnect one connection to continue");
      socket.disconnect();
      return;
    }
  } else {
    socket.emit("error", "Invalid user ID");
    socket.disconnect();
    return;
  }

  // send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(socketMap));

  // Rate limit for socket events
  let msgCount = 0;
  const resetInterval = setInterval(() => {
    msgCount = 0;
  }, 60000); // Reset every minute

  socket.on("newMsg", () => {
    msgCount++;
    if (msgCount > 30) { // Max 30 messages per minute
      socket.emit("error", "Rate limit exceeded");
      return;
    }
  });

  socket.on("disconnect", () => { // remove the disconnected user's socket ID from map
    console.log("A user disconnected", socket.id);
    delete socketMap[userId];
    clearInterval(resetInterval);
    io.emit("getOnlineUsers", Object.keys(socketMap)); // update the list of online users for all connected clients
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

export { io, app, server }; 
