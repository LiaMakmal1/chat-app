import express from "express";
import { checkAuth, signIn, signOut, signup, updateProfile } from "../handlers/accountHandler.js";
import { protectRoute, limiters } from "../secureAccess/index.js";

const router = express.Router();

router.post("/signup", limiters.auth, signup);
router.post("/signIn", limiters.auth, signIn);
router.post("/signOut", signOut);
router.put("/update-profile", protectRoute, updateProfile);
router.get("/check", protectRoute, checkAuth);

export default router;