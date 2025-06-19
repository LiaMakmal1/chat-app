import { createDHInstance, getDHPublicKey, computeSharedSecret } from "../lib/encryption.js";
import { userSocketId, io } from "../lib/realtime.js";

// Store active DH sessions for each user pair
const dhSessions = new Map(); // key: "userId1-userId2", value: { dh, publicKey, sharedKey, status }

// Generate a session key for consistent ordering
const getSessionKey = (userId1, userId2) => {
  return [userId1, userId2].sort().join('-');
};

export const initiateKeyExchange = async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const myId = req.user._id.toString();
    
    if (myId === targetUserId) {
      return res.status(400).json({ error: "Cannot exchange keys with yourself" });
    }

    const sessionKey = getSessionKey(myId, targetUserId);
    
    // Check if session already exists and is active
    const existingSession = dhSessions.get(sessionKey);
    if (existingSession && existingSession.status === 'completed') {
      return res.status(200).json({ 
        message: "Key exchange already completed",
        sessionId: sessionKey,
        publicKey: existingSession.publicKey
      });
    }
    
    // Create new DH instance
    const dh = createDHInstance();
    const publicKey = getDHPublicKey(dh);
    
    // Store session
    dhSessions.set(sessionKey, {
      dh,
      publicKey,
      initiator: myId,
      status: 'pending',
      createdAt: Date.now()
    });

    // Send key exchange request to target user via socket
    const targetSocketId = userSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("keyExchangeRequest", {
        from: myId,
        publicKey: publicKey,
        sessionId: sessionKey
      });
    } else {
      // User is offline, clean up session
      dhSessions.delete(sessionKey);
      return res.status(400).json({ error: "Target user is offline" });
    }

    res.status(200).json({ 
      message: "Key exchange initiated",
      sessionId: sessionKey,
      publicKey: publicKey
    });

  } catch (error) {
    console.error("Error in initiateKeyExchange:", error);
    res.status(500).json({ error: "Failed to initiate key exchange" });
  }
};

export const respondToKeyExchange = async (req, res) => {
  try {
    const { sessionId, otherPublicKey, accept } = req.body;
    const myId = req.user._id.toString();

    if (!accept) {
      // User rejected the key exchange
      dhSessions.delete(sessionId);
      return res.status(200).json({ message: "Key exchange rejected" });
    }

    const session = dhSessions.get(sessionId);
    if (!session) {
      return res.status(400).json({ error: "Invalid or expired session" });
    }

    // Verify this user should be responding to this session
    const [userId1, userId2] = sessionId.split('-');
    if (![userId1, userId2].includes(myId)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Create our DH instance and compute shared secret
    const dh = createDHInstance();
    const myPublicKey = getDHPublicKey(dh);
    const sharedSecret = computeSharedSecret(dh, otherPublicKey);

    // Update session with our info
    session.responder = myId;
    session.responderDH = dh;
    session.responderPublicKey = myPublicKey;
    session.sharedSecret = sharedSecret;
    session.status = 'completed';

    // Send response back to initiator
    const initiatorSocketId = userSocketId(session.initiator);
    if (initiatorSocketId) {
      io.to(initiatorSocketId).emit("keyExchangeResponse", {
        sessionId: sessionId,
        publicKey: myPublicKey,
        accepted: true
      });
    }

    res.status(200).json({ 
      message: "Key exchange completed", 
      publicKey: myPublicKey,
      sessionId: sessionId
    });

  } catch (error) {
    console.error("Error in respondToKeyExchange:", error);
    res.status(500).json({ error: "Failed to respond to key exchange" });
  }
};

export const completeKeyExchange = async (req, res) => {
  try {
    const { sessionId, otherPublicKey } = req.body;
    const myId = req.user._id.toString();

    const session = dhSessions.get(sessionId);
    if (!session || session.initiator !== myId) {
      return res.status(400).json({ error: "Invalid session" });
    }

    // Compute shared secret
    const sharedSecret = computeSharedSecret(session.dh, otherPublicKey);
    session.sharedSecret = sharedSecret;
    session.status = 'completed';

    res.status(200).json({ message: "Key exchange completed successfully" });

  } catch (error) {
    console.error("Error in completeKeyExchange:", error);
    res.status(500).json({ error: "Failed to complete key exchange" });
  }
};

export const getSharedKey = (userId1, userId2) => {
  const sessionKey = getSessionKey(userId1, userId2);
  const session = dhSessions.get(sessionKey);
  
  if (session && session.status === 'completed' && session.sharedSecret) {
    return session.sharedSecret;
  }
  
  return null;
};

export const hasActiveSession = (userId1, userId2) => {
  const sessionKey = getSessionKey(userId1, userId2);
  const session = dhSessions.get(sessionKey);
  return session && session.status === 'completed';
};

// Clean up expired sessions (older than 1 hour)
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [key, session] of dhSessions.entries()) {
    if (now - session.createdAt > oneHour) {
      dhSessions.delete(key);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes