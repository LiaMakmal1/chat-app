// frontend/src/lib/crypto.js - Frontend crypto utilities
class CryptoManager {
  constructor() {
    this.keyPair = null;
    this.sharedKeys = new Map();
  }

  async generateKeyPair() {
    if (this.keyPair) return this.keyPair;
    
    try {
      this.keyPair = await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        false,
        ["deriveKey"]
      );
      return this.keyPair;
    } catch (error) {
      console.error('Failed to generate key pair:', error);
      throw error;
    }
  }

  async exportPublicKey() {
    if (!this.keyPair) await this.generateKeyPair();
    
    try {
      const exported = await window.crypto.subtle.exportKey("raw", this.keyPair.publicKey);
      return btoa(String.fromCharCode(...new Uint8Array(exported)));
    } catch (error) {
      console.error('Failed to export public key:', error);
      throw error;
    }
  }

  async deriveSharedKey(otherPublicKeyBase64, userId) {
    if (!this.keyPair) await this.generateKeyPair();
    
    try {
      const otherKeyBuffer = Uint8Array.from(atob(otherPublicKeyBase64), c => c.charCodeAt(0));
      const otherPublicKey = await window.crypto.subtle.importKey(
        "raw",
        otherKeyBuffer,
        { name: "ECDH", namedCurve: "P-256" },
        false,
        []
      );

      const sharedKey = await window.crypto.subtle.deriveKey(
        { name: "ECDH", public: otherPublicKey },
        this.keyPair.privateKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );

      this.sharedKeys.set(userId, sharedKey);
      return sharedKey;
    } catch (error) {
      console.error('Failed to derive shared key:', error);
      throw error;
    }
  }

  async encrypt(message, userId) {
    const key = this.sharedKeys.get(userId);
    if (!key) throw new Error("No shared key for user");

    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        new TextEncoder().encode(message)
      );

      return {
        encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv))
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  async decrypt(encData, userId) {
    const key = this.sharedKeys.get(userId);
    if (!key) throw new Error("No shared key for user");

    try {
      const encrypted = Uint8Array.from(atob(encData.encrypted), c => c.charCodeAt(0));
      const iv = Uint8Array.from(atob(encData.iv), c => c.charCodeAt(0));

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  getSharedKey(userId) {
    return this.sharedKeys.get(userId);
  }

  hasSharedKey(userId) {
    return this.sharedKeys.has(userId);
  }

  clearKeys() {
    this.keyPair = null;
    this.sharedKeys.clear();
  }
}

// Create and export singleton instance
const cryptoManager = new CryptoManager();

export { cryptoManager };
export default cryptoManager;