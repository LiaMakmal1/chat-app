import express from "express";
import { protectRoute, createLimiter } from "../secureAccess/index.js";
import { 
  initiateKeyExchange, 
  respondToKeyExchange, 
  completeKeyExchange 
} from "../handlers/keyExchangeHandler.js";

const router = express.Router();

const keyLimiter = createLimiter(5 * 60 * 1000, 10, "Too many key exchange attempts");

router.post("/initiate/:id", keyLimiter, protectRoute, initiateKeyExchange);
router.post("/respond", keyLimiter, protectRoute, respondToKeyExchange);
router.post("/complete", keyLimiter, protectRoute, completeKeyExchange);

export default router;