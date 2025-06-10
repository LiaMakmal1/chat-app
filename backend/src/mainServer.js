import express from "express"; 
import dotenv from "dotenv";
import cookieParser from "cookie-parser"; 
import cors from "cors"; 
import path from "path";

import { connectDB } from "./lib/db.js";

import accsessEndpoint from "./endpoints/accessEndpoint.js";
import msgEndpoint from "./endpoints/msgEndpoint.js";
import { app, server } from "./lib/realtime.js";

// security middleware
import { secHeaders, rateLimiter , xssProtection, validateInput, sqlProtect } from "./secureAccess/security.js";

dotenv.config(); // loads environment vars

const PORT = process.env.PORT;
const __dirname = path.resolve(); // the path of the project folder

app.use(secHeaders); 
app.use(rateLimiter ()); 
app.use(xssProtection); 
app.use(validateInput); 
app.use(sqlProtect); 

app.use(express.json({ limit: "10mb" })); 
app.use(cookieParser()); // adds req.cookies 
app.use( // sets CORS in order for the backend to accept requests from the frontend 
  cors({ origin: "http://localhost:5173", credentials: true }));

app.use("/api/auth", accsessEndpoint);
app.use("/api/messages", msgEndpoint);

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
