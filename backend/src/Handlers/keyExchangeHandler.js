import { createDHInstance, getDHPublicKey, computeSharedSecret } from "../lib/encryption.js";
import { userSocketId, io } from "../lib/realtime.js";

const dhSessions = new Map();
const getSessionKey = (userId1, userId2) => [userId1, userId2].sort().join('-');

export const initiateKeyExchange = async (req, res) => {
  try {
    const { id: targetUserId } = req.params;
    const myId = req.user._id.toString();
    
    if (myId === targetUserId) {
      return res.status(400).json({ error: "Cannot exchange keys with yourself" });
    }

    const sessionKey = getSessionKey(myId, targetUserId);
    const existingSession = dhSessions.get(sessionKey);
    
    if (existingSession?.status === 'completed') {
      return res.status(200).json({ 
        message: "Key exchange already completed",
        sessionId: sessionKey,
        publicKey: existingSession.publicKey
      });
    }
    
    const dh = createDHInstance();
    const publicKey = getDHPublicKey(dh);
    
    dhSessions.set(sessionKey, {
      dh, publicKey, initiator: myId, status: 'pending', createdAt: Date.now()
    });

    const targetSocketId = userSocketId(targetUserId);
    if (!targetSocketId) {
      dhSessions.delete(sessionKey);
      return res.status(400).json({ error: "Target user is offline" });
    }

    io.to(targetSocketId).emit("keyExchangeRequest", {
      from: myId, publicKey, sessionId: sessionKey
    });

    res.status(200).json({ 
      message: "Key exchange initiated", sessionId: sessionKey, publicKey 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to initiate key exchange" });
  }
};

export const respondToKeyExchange = async (req, res) => {
  try {
    const { sessionId, otherPublicKey, accept } = req.body;
    const myId = req.user._id.toString();

    if (!accept) {
      dhSessions.delete(sessionId);
      return res.status(200).json({ message: "Key exchange rejected" });
    }

    const session = dhSessions.get(sessionId);
    if (!session || !sessionId.split('-').includes(myId)) {
      return res.status(400).json({ error: "Invalid session" });
    }

    const dh = createDHInstance();
    const myPublicKey = getDHPublicKey(dh);
    const sharedSecret = computeSharedSecret(dh, otherPublicKey);

    Object.assign(session, {
      responder: myId, responderDH: dh, responderPublicKey: myPublicKey,
      sharedSecret, status: 'completed'
    });

    const initiatorSocketId = userSocketId(session.initiator);
    if (initiatorSocketId) {
      io.to(initiatorSocketId).emit("keyExchangeResponse", {
        sessionId, publicKey: myPublicKey, accepted: true
      });
    }

    res.status(200).json({ 
      message: "Key exchange completed", publicKey: myPublicKey, sessionId 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to respond to key exchange" });
  }
};

export const completeKeyExchange = async (req, res) => {
  try {
    const { sessionId, otherPublicKey } = req.body;
    const session = dhSessions.get(sessionId);
    
    if (!session || session.initiator !== req.user._id.toString()) {
      return res.status(400).json({ error: "Invalid session" });
    }

    session.sharedSecret = computeSharedSecret(session.dh, otherPublicKey);
    session.status = 'completed';

    res.status(200).json({ message: "Key exchange completed" });
  } catch (error) {
    res.status(500).json({ error: "Failed to complete key exchange" });
  }
};

export const getSharedKey = (userId1, userId2) => {
  const session = dhSessions.get(getSessionKey(userId1, userId2));
  return session?.status === 'completed' ? session.sharedSecret : null;
};

export const hasActiveSession = (userId1, userId2) => {
  const session = dhSessions.get(getSessionKey(userId1, userId2));
  return session?.status === 'completed';
};

// Cleanup expired sessions
setInterval(() => {
  const oneHour = 3600000;
  for (const [key, session] of dhSessions.entries()) {
    if (Date.now() - session.createdAt > oneHour) {
      dhSessions.delete(key);
    }
  }
}, 300000);