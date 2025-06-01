// This file provides encryption/decryption utilities for sensitive data transmission
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const SECRET_KEY = process.env.ENCRYPTION_SECRET || crypto.randomBytes(32);
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Encrypt sensitive text data
export const encryptText = (text) => {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipherGCM(ALGORITHM, SECRET_KEY, iv);
    cipher.setAAD(Buffer.from("chat-app"));
    
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted,
      iv: iv.toString("hex"),
      tag: tag.toString("hex")
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

// Decrypt sensitive text data
export const decryptText = (encryptedData) => {
  try {
    const { encrypted, iv, tag } = encryptedData;
    
    const decipher = crypto.createDecipherGCM(ALGORITHM, SECRET_KEY, Buffer.from(iv, "hex"));
    decipher.setAAD(Buffer.from("chat-app"));
    decipher.setAuthTag(Buffer.from(tag, "hex"));
    
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    throw new Error("Failed to decrypt data");
  }
};

// Hash sensitive data for storage
export const hashData = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

// Generate secure random tokens
export const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};