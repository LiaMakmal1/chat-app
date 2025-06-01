// This file is the entry point of the backend server

// - index.js connects to MongoDB (the database) 
// - index.js initialize app with json (store and exchange data) && cookie middleware (reads cookies)
// - index.js registers routs for auth && messaging && the API of a user
// - index.js use soket.io in order to have real time communication 
// - index.js starts the server on port 5001

import express from "express"; // type of Node.js web framework
import dotenv from "dotenv";
import cookieParser from "cookie-parser"; //reads and parses the cookies into a JS object
import cors from "cors"; // allows the server to receive different sources
import path from "path";

import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

// Import security middleware
import { 
  securityHeaders, 
  createRateLimit, 
  xssProtection, 
  validateInput, 
  noSqlInjectionProtection 
} from "./middleware/security.middleware.js";

dotenv.config(); // loads environment var into Node.js

const PORT = process.env.PORT;
const __dirname = path.resolve(); // the path of the project folder

// Apply security middleware
app.use(securityHeaders); // Security headers
app.use(createRateLimit()); // General rate limiting
app.use(xssProtection); // XSS protection
app.use(validateInput); // Input validation
app.use(noSqlInjectionProtection); // NoSQL injection protection

app.use(express.json({ limit: "10mb" })); // automatic JSON parsing in request bodies
app.use(cookieParser()); // adds req.cookies 
app.use( // sets CORS in order for the backend to accept requests from the frontend 
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

if (process.env.NODE_ENV === "production") { // checks production mode
  app.use(express.static(path.join(__dirname, "../frontend/dist"))); // serves the static files from  dist
 
  app.get("*", (req, res) => {  // if the file doesnt matched the backend API
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html")); // return index.html and then the React app shows the chat page. 
  });
}

server.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});