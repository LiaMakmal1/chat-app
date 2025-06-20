import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { connectDB } from "./lib/db.js";
import { app, server } from "./lib/realtime.js";

// Route imports
import authRoutes from "./endpoints/accessEndpoint.js";
import messageRoutes from "./endpoints/msgEndpoint.js";
import keyExchangeRoutes from "./endpoints/keyExchangeEndpoint.js";

// Security middleware
import { security } from "./secureAccess/index.js";

dotenv.config();

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();

// Apply security middleware
app.use(security);

// Basic middleware
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(cors({ 
  origin: process.env.NODE_ENV === "development" ? "http://localhost:5173" : true,
  credentials: true 
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/keyexchange", keyExchangeRoutes);

// Production setup
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  connectDB();
});