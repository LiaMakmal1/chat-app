// Frontend crypto utilities for Diffie-Hellman key exchange
// Note: Using Web Crypto API which has limitations compared to Node.js crypto

class DHKeyExchange {
  constructor() {
    this.keyPair = null;
    this.sharedKey = null;
    this.sessions = new Map(); // sessionId -> { publicKey, sharedKey, status }
  }

  // Generate ECDH key pair (Web Crypto API alternative to DH)
  async generateKeyPair() {
    try {
      this.keyPair = await window.crypto.subtle.generateKey(
        {
          name: "ECDH",
          namedCurve: "P-256"
        },
        false, // extractable
        ["deriveKey"]
      );
      return this.keyPair;
    } catch (error) {
      console.error("Failed to generate key pair:", error);
      throw error;
    }
  }

  // Export public key for transmission
  async exportPublicKey() {
    if (!this.keyPair) {
      await this.generateKeyPair();
    }
    
    try {
      const exported = await window.crypto.subtle.exportKey(
        "raw",
        this.keyPair.publicKey
      );
      return this.arrayBufferToBase64(exported);
    } catch (error) {
      console.error("Failed to export public key:", error);
      throw error;
    }
  }

  // Import other party's public key and derive shared secret
  async deriveSharedKey(otherPublicKeyBase64) {
    try {
      const otherPublicKeyBuffer = this.base64ToArrayBuffer(otherPublicKeyBase64);
      
      const otherPublicKey = await window.crypto.subtle.importKey(
        "raw",
        otherPublicKeyBuffer,
        {
          name: "ECDH",
          namedCurve: "P-256"
        },
        false,
        []
      );

      const sharedKey = await window.crypto.subtle.deriveKey(
        {
          name: "ECDH",
          public: otherPublicKey
        },
        this.keyPair.privateKey,
        {
          name: "AES-GCM",
          length: 256
        },
        false, // not extractable
        ["encrypt", "decrypt"]
      );

      this.sharedKey = sharedKey;
      return sharedKey;
    } catch (error) {
      console.error("Failed to derive shared key:", error);
      throw error;
    }
  }

  // Encrypt message with shared key
  async encryptMessage(message, sharedKey = null) {
    const key = sharedKey || this.sharedKey;
    if (!key) {
      throw new Error("No shared key available for encryption");
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const iv = window.crypto.getRandomValues(new Uint8Array(16));

      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv,
          additionalData: encoder.encode("chat-app")
        },
        key,
        data
      );

      return {
        encrypted: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv)
      };
    } catch (error) {
      console.error("Encryption failed:", error);
      throw error;
    }
  }

  // Decrypt message with shared key
  async decryptMessage(encryptedData, sharedKey = null) {
    const key = sharedKey || this.sharedKey;
    if (!key) {
      throw new Error("No shared key available for decryption");
    }

    try {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      
      const encrypted = this.base64ToArrayBuffer(encryptedData.encrypted);
      const iv = this.base64ToArrayBuffer(encryptedData.iv);

      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv,
          additionalData: encoder.encode("chat-app")
        },
        key,
        encrypted
      );

      return decoder.decode(decrypted);
    } catch (error) {
      console.error("Decryption failed:", error);
      throw error;
    }
  }

  // Store session key for a specific user
  storeSession(sessionId, publicKey, sharedKey, status = 'completed') {
    this.sessions.set(sessionId, {
      publicKey,
      sharedKey,
      status,
      createdAt: Date.now()
    });
  }

  // Get session for a specific user pair
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  // Check if session exists and is active
  hasActiveSession(sessionId) {
    const session = this.sessions.get(sessionId);
    return session && session.status === 'completed' && session.sharedKey;
  }

  // Utility functions
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Generate session ID for user pair
  generateSessionId(userId1, userId2) {
    return [userId1, userId2].sort().join('-');
  }
}

export default DHKeyExchange;