// This file exports the routes related to the messaging  in the backend API using Express

// - message.route.js creats a list of users for the sidebar
// - message.route.js fetchs all messages exchanged with user
// - message.route.js sends new messages to a specific user

import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getMessages, getUsersForSidebar, sendMessage } from "../controllers/message.controller.js";
import { messageRateLimit } from "../middleware/security.middleware.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);

router.post("/send/:id", protectRoute, messageRateLimit, sendMessage);

export default router;