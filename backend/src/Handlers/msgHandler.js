import User from "../schema/userSchema.js"
import Message from "../schema/msgSchema.js";

import { userSocketId, io } from "../lib/realtime.js";
import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";
import { encText, decText, aesEncryptWithKey, aesDecryptWithKey } from "../lib/encryption.js";

import { getSharedKey } from "../lib/dhManager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Message tracking to prevent duplicates at server level
const MessageTracker = {
  recentMessages: new Map(), // messageId -> timestamp
  
  isDuplicate: (messageId, timeWindow = 30000) => { // 30 second window
    const now = Date.now();
    
    if (MessageTracker.recentMessages.has(messageId)) {
      const timestamp = MessageTracker.recentMessages.get(messageId);
      if (now - timestamp < timeWindow) {
        console.warn(`🚨 Server: Duplicate message attempt blocked: ${messageId}`);
        return true;
      }
    }
    
    MessageTracker.recentMessages.set(messageId, now);
    return false;
  },
  
  cleanup: () => {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    
    for (const [messageId, timestamp] of MessageTracker.recentMessages.entries()) {
      if (now - timestamp > timeWindow) {
        MessageTracker.recentMessages.delete(messageId);
      }
    }
  }
};

// Cleanup old message tracking entries every 5 minutes
setInterval(() => {
  MessageTracker.cleanup();
}, 5 * 60 * 1000);

// returns a list of all users except the currently user
export const UserList = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const users = await User.find({ _id: { $ne: currentUserId } }).select("fullName avatar _id email");
    console.log(`👥 Loaded ${users.length} users for ${currentUserId}`);
    res.status(200).json(users);
  } catch (err) {
    console.log("❌ UserList error: " + err.message);
    res.status(500).json({ error: "Failed to get users" });
  }
};

// get chat history
export const history = async (req, res) => {
  const { id: receiverId } = req.params;
  const senderId = req.user._id;

  try {
    console.log(`📚 Loading message history between ${senderId} and ${receiverId}`);
    
    // Find messages and sort by creation date, ensure uniqueness by _id
    let msgs = await Message.find({
      $or: [
        { fromUserId: senderId, toUserId: receiverId },
        { fromUserId: receiverId, toUserId: senderId },
      ],
    }).sort({ createdAt: 1 });

    console.log(`📊 Found ${msgs.length} messages in database`);

    // Remove any potential duplicates at database level (shouldn't happen but safety first)
    const uniqueMessages = msgs.reduce((acc, msg) => {
      const exists = acc.find(m => m._id.toString() === msg._id.toString());
      if (!exists) {
        acc.push(msg);
      } else {
        console.warn(`🚨 Database duplicate found and removed: ${msg._id}`);
      }
      return acc;
    }, []);

    if (uniqueMessages.length !== msgs.length) {
      console.warn(`🚨 Removed ${msgs.length - uniqueMessages.length} duplicate messages from database result`);
    }

    // Decrypt messages
    let result = [];
    for (let msg of uniqueMessages) {
      try {
        const obj = msg.toObject();
        
        if (msg.text && msg.encData) {
          const sharedKey = getSharedKey(senderId, receiverId);
          if (sharedKey) {
            try {
              obj.text = aesDecryptWithKey(msg.encData, sharedKey);
              console.log(`🔓 Decrypted message ${msg._id.toString().slice(-6)} with DH key`);
            } catch (dhError) {
              console.log(`⚠️ DH decryption failed for ${msg._id.toString().slice(-6)}, trying fallback`);
              try {
                obj.text = decText(msg.encData);
              } catch (fallbackError) {
                console.log(`❌ All decryption failed for ${msg._id.toString().slice(-6)}`);
                obj.text = "[Encrypted message - unable to decrypt]";
              }
            }
          } else {
            try {
              obj.text = decText(msg.encData);
            } catch (fallbackError) {
              console.log(`❌ Fallback decryption failed for ${msg._id.toString().slice(-6)}`);
              obj.text = "[Encrypted message - no key available]";
            }
          }
          
          delete obj.encData;
        }
        
        result.push(obj);
      } catch (e) {
        console.log(`⚠️ Message processing failed for ${msg._id}:`, e.message);
        const obj = msg.toObject();
        obj.text = obj.text || "[Message could not be processed]";
        delete obj.encData;
        result.push(obj);
      }
    }

    console.log(`✅ Returning ${result.length} processed messages`);
    return res.status(200).json(result);
  } catch (e) {
    console.log("❌ History fetch error:", e);
    res.status(500).json({ error: "Could not load messages" });
  }
};

export async function sendMsg(req, res) {
  try {
    const msgText = req.body.text;
    const msgImage = req.body.image;
    const targetUserId = req.params.id;
    const sourceUserId = req.user._id;

    console.log(`📤 Sending message from ${sourceUserId} to ${targetUserId}`);

    // Validate input
    if (!msgText && !msgImage) {
      return res.status(400).json({ error: "Message must contain text or image" });
    }

    let imageUrl;
    if (msgImage) {
      try {
        const workerPath = path.join(__dirname, "../workers/imgHandler.js");
        const worker = new Worker(workerPath);

        const imgProcess = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            worker.terminate();
            reject(new Error('Image processing timeout'));
          }, 30000); // 30 second timeout

          worker.postMessage({ image: msgImage });

          worker.on("message", (result) => {
            clearTimeout(timeout);
            worker.terminate();
            if (result.success) {
              resolve(result.url);
            } else {
              reject(new Error(result.error));
            }
          });

          worker.on("error", (error) => {
            clearTimeout(timeout);
            worker.terminate();
            reject(error);
          });
        });

        imageUrl = await imgProcess;
        console.log(`🖼️ Image processed successfully`);
      } catch (error) {
        console.error("❌ Image processing failed:", error);
        return res.status(500).json({ error: "Failed to process image" });
      }
    }

    // Encrypt text data
    let encData;
    if (msgText) {
      try {
        const sharedKey = getSharedKey(sourceUserId, targetUserId);
        if (sharedKey) {
          encData = aesEncryptWithKey(msgText, sharedKey);
          console.log(`🔒 Encrypted message with DH key`);
        } else {
          encData = encText(msgText);
          console.log(`🔒 Encrypted message with fallback key`);
        }
      } catch (error) {
        console.error("❌ Encryption error:", error);
        return res.status(500).json({ error: "Failed to secure message" });
      }
    }

    // Create and save message
    const newMsg = new Message({
      fromUserId: sourceUserId,
      toUserId: targetUserId,
      text: msgText ? "[Encrypted]" : undefined,
      encData: encData,
      image: imageUrl,
    });

    await newMsg.save();
    const messageId = newMsg._id.toString();
    
    console.log(`💾 Message saved to database: ${messageId.slice(-6)}`);

    // Check if we've already processed this message (extra safety)
    if (MessageTracker.isDuplicate(messageId)) {
      console.warn(`🚨 Duplicate message send attempt blocked: ${messageId}`);
      return res.status(400).json({ error: "Duplicate message detected" });
    }

    // Prepare message for socket transmission
    const socketMessage = {
      ...newMsg.toObject(),
      text: msgText, // Send decrypted text via socket
      encData: undefined
    };

    // Send to recipient if online
    const recipientSocketId = userSocketId(targetUserId);
    if (recipientSocketId) {
      console.log(`📡 Sending message to recipient via socket: ${targetUserId}`);
      io.to(recipientSocketId).emit("newMsg", socketMessage);
    } else {
      console.log(`📴 Recipient ${targetUserId} is offline, message will be delivered when they connect`);
    }

    // Send confirmation back to sender
    const response = {
      ...newMsg.toObject(),
      text: msgText, // Send decrypted text back to sender
      encData: undefined
    };

    console.log(`✅ Message sent successfully: ${messageId.slice(-6)}`);
    res.status(201).json(response);

  } catch (error) {
    console.log("❌ Message send failed:", error.message);
    res.status(500).json({ error: "Couldn't send message", success: false });
  }
}