import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
    credentials: true,
  },
  maxHttpBufferSize: 1e6,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Track online users
const socketMap = {}; // {userId: socketId}

export function userSocketId(userId) {
  return socketMap[userId];
}

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  // Validate userId
  if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
    socket.emit("error", "Invalid user ID");
    socket.disconnect();
    return;
  }

  socket.userId = userId;
  socketMap[userId] = socket.id;

  // Broadcast online users
  io.emit("getOnlineUsers", Object.keys(socketMap));

  // Rate limiting
  let eventCount = 0;
  const resetInterval = setInterval(() => { eventCount = 0; }, 60000);

  const rateLimit = () => {
    eventCount++;
    if (eventCount > 30) {
      socket.emit("error", "Rate limit exceeded");
      return false;
    }
    return true;
  };

  // Key exchange events
  socket.on("keyExchangeRequest", (data) => {
    if (!rateLimit()) return;
    
    const targetSocket = socketMap[data.targetUserId];
    if (targetSocket) {
      io.to(targetSocket).emit("keyExchangeRequest", {
        from: userId,
        publicKey: data.publicKey
      });
    }
  });

  socket.on("keyExchangeResponse", (data) => {
    if (!rateLimit()) return;
    
    const targetSocket = socketMap[data.targetUserId];
    if (targetSocket) {
      io.to(targetSocket).emit("keyExchangeResponse", {
        from: userId,
        publicKey: data.publicKey,
        accepted: data.accepted
      });
    }
  });

  socket.on("disconnect", () => {
    delete socketMap[userId];
    clearInterval(resetInterval);
    io.emit("getOnlineUsers", Object.keys(socketMap));
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

export { io, app, server };