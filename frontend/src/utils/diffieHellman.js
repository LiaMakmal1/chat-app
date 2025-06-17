// frontend/src/utils/diffieHellman.js - Simple Diffie-Hellman implementation

// Safe prime and generator (RFC 3526 - 2048-bit MODP Group)
const PRIME = BigInt('0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF');
const GENERATOR = BigInt(2);

export class DiffieHellman {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
  }

  // Generate a random private key
  generatePrivateKey() {
    const bytes = new Uint8Array(32); // 256 bits
    crypto.getRandomValues(bytes);
    
    // Convert to BigInt and ensure it's within valid range
    let privateKey = BigInt(0);
    for (let i = 0; i < bytes.length; i++) {
      privateKey = (privateKey << BigInt(8)) | BigInt(bytes[i]);
    }
    
    // Ensure private key is between 1 and PRIME-1
    this.privateKey = (privateKey % (PRIME - BigInt(1))) + BigInt(1);
    return this.privateKey;
  }

  // Generate public key from private key
  generatePublicKey() {
    if (!this.privateKey) {
      this.generatePrivateKey();
    }
    
    // Public key = g^privateKey mod p
    this.publicKey = this.modPow(GENERATOR, this.privateKey, PRIME);
    return this.publicKey;
  }

  // Generate shared secret from other party's public key
  generateSharedSecret(otherPublicKey) {
    if (!this.privateKey) {
      throw new Error('Private key not generated');
    }
    
    const otherPubKey = typeof otherPublicKey === 'string' 
      ? BigInt(otherPublicKey) 
      : otherPublicKey;
    
    // Shared secret = otherPublicKey^privateKey mod p
    const sharedSecret = this.modPow(otherPubKey, this.privateKey, PRIME);
    
    // Convert to hex string for consistent handling
    return sharedSecret.toString(16).padStart(64, '0');
  }

  // Efficient modular exponentiation (a^b mod m)
  modPow(base, exponent, modulus) {
    let result = BigInt(1);
    base = base % modulus;
    
    while (exponent > 0) {
      if (exponent % BigInt(2) === BigInt(1)) {
        result = (result * base) % modulus;
      }
      exponent = exponent >> BigInt(1);
      base = (base * base) % modulus;
    }
    
    return result;
  }

  // Convert public key to string for transmission
  getPublicKeyString() {
    if (!this.publicKey) {
      this.generatePublicKey();
    }
    return this.publicKey.toString(16);
  }

  // Static method to create a new DH instance with keys
  static create() {
    const dh = new DiffieHellman();
    dh.generatePublicKey();
    return dh;
  }
}

// Simple key derivation from DH shared secret
export async function deriveKeyFromSharedSecret(sharedSecret) {
  // Convert hex string to bytes
  const secretBytes = new Uint8Array(
    sharedSecret.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  );
  
  // Use PBKDF2 to derive a proper AES key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = new TextEncoder().encode('chatty_dh_salt_2024');
  
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  // Export as raw bytes and convert to hex
  const keyBytes = await crypto.subtle.exportKey('raw', derivedKey);
  return Array.from(new Uint8Array(keyBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}