import express from "express";
import { protectRoute } from "../middleware/requireAuth.js";
import { 
  initiateKeyExchange, 
  respondToKeyExchange, 
  completeKeyExchange 
} from "../handlers/keyExchangeHandler.js";
import { rateLimiter } from "../secureAccess/security.js";

const router = express.Router();

// Rate limiting for key exchange (max 10 per 5 minutes)
const keyExchangeLimiter = rateLimiter(5 * 60 * 1000, 10);

router.post("/initiate/:id", keyExchangeLimiter, protectRoute, initiateKeyExchange);
router.post("/respond", keyExchangeLimiter, protectRoute, respondToKeyExchange);
router.post("/complete", keyExchangeLimiter, protectRoute, completeKeyExchange);

export default router;