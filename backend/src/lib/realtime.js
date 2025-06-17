//  handle real-time chat, track who's online, and send updates

import { Server } from "socket.io";
import http from "http";
import express from "express";

import {
  storePublicKey,
  storePrivateKey,
  computeSharedKey,
} from "./dhManager.js"; // adjust path if needed



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
    socket.userId = userId;
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
  
  // Notify user about reconnection - they may need to re-exchange keys
  socket.emit("connectionEstablished", { 
    userId: userId,
    message: "Connected successfully. You may need to re-exchange keys for encrypted messaging." 
  });

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

  // Handle key exchange events
  socket.on("keyExchangeRequest", (data) => {
    msgCount++;
    if (msgCount > 30) {
      socket.emit("error", "Rate limit exceeded");
      return;
    }
    // Forward key exchange request to target user
    if (data && data.targetUserId && socketMap[data.targetUserId]) {
      socket.to(socketMap[data.targetUserId]).emit("keyExchangeRequest", {
        from: userId,
        publicKey: data.publicKey,
        sessionId: data.sessionId
      });
    }
  });

  socket.on("keyExchangeResponse", (data) => {
    msgCount++;
    if (msgCount > 30) {
      socket.emit("error", "Rate limit exceeded");
      return;
    }
    // Forward key exchange response to initiator
    if (data && data.targetUserId && socketMap[data.targetUserId]) {
      socket.to(socketMap[data.targetUserId]).emit("keyExchangeResponse", {
        from: userId,
        publicKey: data.publicKey,
        sessionId: data.sessionId,
        accepted: data.accepted
      });
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

  socket.on("exchange-dh", ({ toUserId, publicKey }) => {
  const fromUserId = socket.userId;

  // 1. Save sender’s public key
  storePublicKey(fromUserId, publicKey);

  // 2. Relay sender’s public key to recipient
  const toSocketId = socketMap[toUserId];
  if (toSocketId) {
    io.to(toSocketId).emit("receive-dh", {
      fromUserId,
      publicKey,
    });
  }
});



});

export { io, app, server }; 