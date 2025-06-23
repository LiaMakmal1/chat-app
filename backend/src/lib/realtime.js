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

// Track online users and typing status
const socketMap = {}; // {userId: socketId}
const typingUsers = new Map(); // userId -> { typingTo: userId, timeout: timeoutId }

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
    if (eventCount > 50) { // Increased limit for typing events
      socket.emit("error", "Rate limit exceeded");
      return false;
    }
    return true;
  };

  // Typing indicator events
  socket.on("typing", (data) => {
    if (!rateLimit()) return;
    
    const { targetUserId, isTyping } = data;
    const targetSocket = socketMap[targetUserId];
    
    if (targetSocket) {
      if (isTyping) {
        // User started typing
        io.to(targetSocket).emit("userTyping", {
          userId: userId,
          isTyping: true
        });

        // Clear any existing timeout for this user
        const existing = typingUsers.get(userId);
        if (existing?.timeout) {
          clearTimeout(existing.timeout);
        }

        // Set timeout to auto-stop typing after 3 seconds
        const timeout = setTimeout(() => {
          if (socketMap[targetUserId]) {
            io.to(socketMap[targetUserId]).emit("userTyping", {
              userId: userId,
              isTyping: false
            });
          }
          typingUsers.delete(userId);
        }, 3000);

        typingUsers.set(userId, { typingTo: targetUserId, timeout });
      } else {
        // User stopped typing
        io.to(targetSocket).emit("userTyping", {
          userId: userId,
          isTyping: false
        });

        // Clear timeout
        const existing = typingUsers.get(userId);
        if (existing?.timeout) {
          clearTimeout(existing.timeout);
        }
        typingUsers.delete(userId);
      }
    }
  });

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
    
    // Clear any typing timeouts for this user
    const typingData = typingUsers.get(userId);
    if (typingData) {
      clearTimeout(typingData.timeout);
      
      // Notify the target user that typing stopped
      if (typingData.typingTo && socketMap[typingData.typingTo]) {
        io.to(socketMap[typingData.typingTo]).emit("userTyping", {
          userId: userId,
          isTyping: false
        });
      }
      
      typingUsers.delete(userId);
    }
    
    clearInterval(resetInterval);
    io.emit("getOnlineUsers", Object.keys(socketMap));
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

export { io, app, server };