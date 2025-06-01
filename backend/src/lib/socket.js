// This file creates a Socket.IO server to manage real-time connections,
  // track online users, and push updates to connected clients

import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express(); 
const server = http.createServer(app); // create an HTTP server using Express

// create new Socket.IO server and attach it to the HTTP server
// configure CORS to allow the frontend (localhost:5173) to connect to it
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

// eported utility function to get a user's socket ID by user ID
export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// contains a map of userId : socketId, used to know which users are online
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {  // handle new client connections
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  
  // Validate userId before storing
  if (userId && typeof userId === "string" && userId.match(/^[0-9a-fA-F]{24}$/)) {
    userSocketMap[userId] = socket.id;
    
    // Limit concurrent connections per user
    const userConnections = Object.values(userSocketMap).filter(id => id === socket.id).length;
    if (userConnections > 3) {
      socket.emit("error", "Too many concurrent connections");
      socket.disconnect();
      return;
    }
  } else {
    socket.emit("error", "Invalid user ID");
    socket.disconnect();
    return;
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Rate limit for socket events
  let messageCount = 0;
  const resetInterval = setInterval(() => {
    messageCount = 0;
  }, 60000); // Reset every minute

  socket.on("newMessage", () => {
    messageCount++;
    if (messageCount > 30) { // Max 30 messages per minute
      socket.emit("error", "Rate limit exceeded");
      return;
    }
  });

  socket.on("disconnect", () => { // remove the disconnected user's socket ID from map
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    clearInterval(resetInterval);
    io.emit("getOnlineUsers", Object.keys(userSocketMap)); // update the list of online users for all connected clients
  });

  // Handle connection errors
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

export { io, app, server }; // export the instances setup to be used in the main server 