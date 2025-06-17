import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const DH_PRIME_LENGTH = 2048;

// Diffie-Hellman key exchange utilities
export const createDHInstance = () => {
  const dh = crypto.createDiffieHellman(DH_PRIME_LENGTH);
  dh.generateKeys();
  return dh;
};

export const getDHPublicKey = (dh) => {
  return dh.getPublicKey('base64');
};

export const computeSharedSecret = (dh, otherPublicKey) => {
  const otherKeyBuffer = Buffer.from(otherPublicKey, 'base64');
  const sharedSecret = dh.computeSecret(otherKeyBuffer);
  // Derive AES key from shared secret using HKDF
  return crypto.hkdfSync('sha256', sharedSecret, '', 'chat-app-key', 32);
};

// Encrypt text with shared key
export const encryptWithSharedKey = (text, sharedKey) => {
  try {
    if (!text) throw new Error("No data to encrypt");
    if (!sharedKey) throw new Error("No shared key provided");

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, sharedKey, iv);
    cipher.setAAD(Buffer.from("chat-app"));

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

// Decrypt text with shared key
export const decryptWithSharedKey = (encData, sharedKey) => {
  try {
    if (!encData || !encData.encrypted || !encData.iv || !encData.tag) {
      throw new Error("Incomplete encrypted data");
    }
    if (!sharedKey) throw new Error("No shared key provided");

    const { encrypted, iv, tag } = encData;

    const decipher = crypto.createDecipheriv(ALGORITHM, sharedKey, Buffer.from(iv, "hex"));
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

// Legacy functions for backward compatibility
const SECRET_KEY = process.env.ENCRYPTION_SECRET
  ? Buffer.from(process.env.ENCRYPTION_SECRET, "hex")
  : crypto.randomBytes(32);

export const encText = (text) => {
  try {
    if (!text) throw new Error("No data to encrypt");

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
    cipher.setAAD(Buffer.from("chat-app"));

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const tag = cipher.getAuthTag();

    return {
      encrypted: encrypted,
      iv: iv.toString("hex"),
      tag: tag.toString("hex"),
    };
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
};

export const decText = (encData) => {
  try {
    if (!encData || !encData.encrypted || !encData.iv || !encData.tag) {
      throw new Error("Incomplete encrypted data");
    }

    const { encrypted, iv, tag } = encData;

    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, Buffer.from(iv, "hex"));
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

export const hashData = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

export const secureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};


// Encrypt a message using AES-256-GCM with a provided key (Buffer)
export function aesEncryptWithKey(plaintext, key) {
  const iv = crypto.randomBytes(12); // GCM standard IV size is 12 bytes
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return {
    cipherText: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    tag: authTag.toString("hex"),
  };
}

// Decrypt a message using AES-256-GCM with a provided key (Buffer)
export function aesDecryptWithKey(encData, key) {
  const { cipherText, iv, tag } = encData;

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherText, "hex")),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}