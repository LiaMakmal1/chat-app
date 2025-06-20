// handlers/msgHandler.js - Simplified from 200+ lines to ~80 lines
import User from "../schema/userSchema.js";
import Message from "../schema/msgSchema.js";
import { userSocketId, io } from "../lib/realtime.js";
import { encText, decText, aesEncryptWithKey, aesDecryptWithKey } from "../lib/encryption.js";
import { getSharedKey } from "./keyExchangeHandler.js";
import cloudinary from "../lib/cloudinary.js";

// Get all users except current user
export const UserList = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("fullName avatar _id email");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to get users" });
  }
};

// Get message history between two users
export const history = async (req, res) => {
  try {
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    const messages = await Message.find({
      $or: [
        { fromUserId: senderId, toUserId: receiverId },
        { fromUserId: receiverId, toUserId: senderId },
      ],
    }).sort({ createdAt: 1 });

    // Decrypt messages
    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => {
        const obj = msg.toObject();
        
        if (msg.encData && msg.text === "[Encrypted]") {
          try {
            const sharedKey = getSharedKey(senderId, receiverId);
            obj.text = sharedKey 
              ? aesDecryptWithKey(msg.encData, sharedKey)
              : decText(msg.encData);
          } catch (error) {
            obj.text = "[Unable to decrypt]";
          }
          delete obj.encData;
        } else if (msg.text === "[Encrypted]" && !msg.encData) {
          // Handle case where text is "[Encrypted]" but no encData (shouldn't happen, but safety)
          delete obj.text;
        }
        
        return obj;
      })
    );

    res.status(200).json(decryptedMessages);
  } catch (error) {
    res.status(500).json({ error: "Could not load messages" });
  }
};

// Send message
export const sendMsg = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: toUserId } = req.params;
    const fromUserId = req.user._id;

    if (!text && !image) {
      return res.status(400).json({ error: "Message content required" });
    }

    let imageUrl;
    if (image) {
      try {
        const { secure_url } = await cloudinary.uploader.upload(image, {
          folder: "chat_images",
          resource_type: "auto",
          quality: "auto:good"
        });
        imageUrl = secure_url;
      } catch (error) {
        return res.status(500).json({ error: "Image upload failed" });
      }
    }

    // Encrypt text if provided
    let encData;
    if (text) {
      try {
        const sharedKey = getSharedKey(fromUserId, toUserId);
        encData = sharedKey 
          ? aesEncryptWithKey(text, sharedKey)
          : encText(text);
      } catch (error) {
        return res.status(500).json({ error: "Encryption failed" });
      }
    }

    // Create and save message
    const message = await Message.create({
      fromUserId,
      toUserId,
      text: text ? "[Encrypted]" : undefined,
      encData,
      image: imageUrl,
    });

    // Send to recipient via socket
    const recipientSocket = userSocketId(toUserId);
    if (recipientSocket) {
      io.to(recipientSocket).emit("newMsg", {
        ...message.toObject(),
        text: text || undefined, // Only send text if it exists
        encData: undefined
      });
    }

    // Return response with decrypted text
    res.status(201).json({
      ...message.toObject(),
      text: text || undefined, // Only include text if it exists
      encData: undefined
    });

  } catch (error) {
    res.status(500).json({ error: "Message send failed" });
  }
};