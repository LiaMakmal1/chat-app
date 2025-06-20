import express from "express";
import { protectRoute, limiters } from "../secureAccess/index.js";
import { history, UserList, sendMsg } from "../handlers/msgHandler.js";

const router = express.Router();

router.get("/users", protectRoute, UserList);
router.get("/:id", protectRoute, history);
router.post("/send/:id", protectRoute, limiters.messages, sendMsg);

export default router;