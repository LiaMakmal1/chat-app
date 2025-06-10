import User from "../schema/userSchema.js"
import Message from "../schema/msgSchema.js";

import { userSocketId, io } from "../lib/realtime.js";
import { Worker } from "worker_threads";
import path from "path";
import { fileURLToPath } from "url";
import { encText, decText } from "../lib/encryption.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// returns a list of all users except the currently user
export const UserList = async (req, res) => {
  try {
    const currentUserId = req.user._id;
        // all the users except the currently
    const users = await User.find({ _id: { $ne: currentUserId } }).select("userName avatar _id email");

    res.status(200).json(users);
  } catch (err) {
    console.log("UserList error: " + err.message);
    res.status(500).json({ error: "Failed to get users" });
  }
};

// get chat history
export const history = async (req, res) => {
  const { id: receiverId } = req.params; // other user
  const senderId = req.user._id;

  try {
    // find messages
    let msgs = await Message.find({
      $or: [
        { fromUserId: senderId, toUserId: receiverId },
        { fromUserId: receiverId, toUserId: senderId },
      ],
    });

    // decrypt
    let result = [];
    for(let msg of msgs) {
      try {
        if (msg.text && msg.encData) {
          const obj = msg.toObject();
          obj.text = decText(msg.encData);
          delete obj.encData;
          result.push(obj);
        } else {
          result.push(msg.toObject());
        }
      } catch (e) {
        console.log("Decrypt failed:", e);
        const obj = msg.toObject();
        obj.text = "[Encrypted message]";
        result.push(obj);
      }
    }

    return res.status(200).json(result);
  } catch (e) {
    console.log("History fetch error:", e);
    res.status(500).json({ error: "Could not load messages" });
  }
};

export async function sendMsg(req, res) {
  try {
    const msgText = req.body.text;
    const msgImage = req.body.image;
    const targetUserId = req.params.id;
    const sourceUserId = req.user._id;

    let imageUrl;
    if (msgImage) {
      // worker thread for image processing to avoid blocking main thread
      const workerPath = path.join(__dirname, "../workers/imgHandler.js");
      const worker = new Worker(workerPath);

      // Process image in worker thread
      const imgProcess = new Promise((resolve, reject) => {
        worker.postMessage({ image: msgImage });

        worker.on("message", (result) => {
          worker.terminate();
          if (result.success) {
            resolve(result.url);
          } else {
            reject(new Error(result.error));
          }
        });

        worker.on("error", (error) => {
          worker.terminate();
          reject(error);
        });
      });

      imageUrl = await imgProcess;
    }

    // Encrypt sensitive text data before saving
    let encData;
    if (msgText) {
      try {
        encData = encText(msgText);
      } catch (error) {
        console.error("Encryption error:", error);
        return res.status(500).json({ error: "Failed to secure message" });
      }
    }

    // create message in DB
    const newMsg = new Message({
      fromUserId: sourceUserId,
      toUserId: targetUserId,
      text: msgText ? "[Encrypted]" : undefined,
      encData: encData,
      image: imageUrl,
    });

    await newMsg.save();

    // send to recipient if online
    const recipientSocketId = userSocketId(targetUserId);
    if (recipientSocketId) {
      const msgForSocket = {
        ...newMsg.toObject(),
        text: msgText,
        encData: undefined
      };
      io.to(recipientSocketId).emit("newMsg", msgForSocket);
    }

    // send back to sender
    const msgResponse = {
      ...newMsg.toObject(),
      text: msgText,
      encData: undefined
    };

    res.status(201).json(msgResponse);
  } catch (error) {
    // TODO: improve error handling
    console.log("Message send failed: " + error.message);
    res.status(500).json({ error: "Couldn't send message", success: false });
  }
};
