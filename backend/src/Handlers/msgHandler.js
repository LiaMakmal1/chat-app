import User from "../schema/userSchema.js";
import Message from "../schema/msgSchema.js";
import { userSocketId, io } from "../lib/realtime.js";
import { encText, decText, aesEncryptWithKey, aesDecryptWithKey } from "../lib/encryption.js";
import { getSharedKey } from "./keyExchangeHandler.js";
import cloudinary from "../lib/cloudinary.js";

export const UserList = async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select("fullName avatar _id email");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to get users" });
  }
};

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
        }
        
        return obj;
      })
    );

    res.status(200).json(decryptedMessages);
  } catch (error) {
    res.status(500).json({ error: "Could not load messages" });
  }
};

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
      const { secure_url } = await cloudinary.uploader.upload(image, {
        folder: "chat_images",
        resource_type: "auto",
        quality: "auto:good"
      });
      imageUrl = secure_url;
    }

    let encData;
    if (text) {
      const sharedKey = getSharedKey(fromUserId, toUserId);
      encData = sharedKey 
        ? aesEncryptWithKey(text, sharedKey)
        : encText(text);
    }

    const message = await Message.create({
      fromUserId,
      toUserId,
      text: text ? "[Encrypted]" : undefined,
      encData,
      image: imageUrl,
    });

    const recipientSocket = userSocketId(toUserId);
    if (recipientSocket) {
      io.to(recipientSocket).emit("newMsg", {
        ...message.toObject(),
        text: text || undefined,
        encData: undefined
      });
    }

    res.status(201).json({
      ...message.toObject(),
      text: text || undefined,
      encData: undefined
    });
  } catch (error) {
    res.status(500).json({ error: "Message send failed" });
  }
};