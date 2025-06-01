// This file defines the Mongoose schema and model for messages in the db

// Mongoose schema defines the structure of documents within a MongoDB

import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
    },
    encryptedData: { // store encrypted message data
      encrypted: String,
      iv: String,
      tag: String
    },
    image: { // store as a URL or base64 string
      type: String, 
    },
  },
  { timestamps: true } // allows automatic createdAt and updatedAt fields
);

const Message = mongoose.model("Message", messageSchema); // export the created model

export default Message;