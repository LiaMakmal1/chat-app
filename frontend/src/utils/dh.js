class DHKeyExchange {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
    this.sharedKeys = new Map();
  }

  async generateKeys() {
    try {
      const privateKeyArray = new Uint8Array(32);
      crypto.getRandomValues(privateKeyArray);
      
      let privateKey = BigInt(0);
      for (let i = 0; i < privateKeyArray.length; i++) {
        privateKey = (privateKey << BigInt(8)) | BigInt(privateKeyArray[i]);
      }
      
      const PRIME = BigInt('0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF');
      const GENERATOR = BigInt(2);
      
      this.privateKey = (privateKey % (PRIME - BigInt(1))) + BigInt(1);
      this.publicKey = this.modPow(GENERATOR, this.privateKey, PRIME);
      
      return {
        privateKey: this.privateKey.toString(16),
        publicKey: this.publicKey.toString(16)
      };
    } catch (error) {
      console.error('Failed to generate DH keys:', error);
      throw error;
    }
  }

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

  async computeSharedSecret(peerPublicKeyHex) {
    if (!this.privateKey) {
      throw new Error('Private key not generated');
    }

    const PRIME = BigInt('0xFFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF');
    
    try {
      const cleanHex = peerPublicKeyHex.replace(/^0x/, '').toLowerCase();
      const peerPublicKey = BigInt('0x' + cleanHex);
      
      if (peerPublicKey <= BigInt(1) || peerPublicKey >= PRIME) {
        throw new Error('Invalid peer public key range');
      }
      
      const sharedSecret = this.modPow(peerPublicKey, this.privateKey, PRIME);
      const secretHex = sharedSecret.toString(16).padStart(512, '0');
      const secretBytes = this.hexToBytes(secretHex);
      
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        secretBytes.slice(0, 32),
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
        false,
        ['encrypt', 'decrypt']
      );

      return derivedKey;
    } catch (error) {
      console.error('Shared secret computation failed:', error);
      throw new Error(`Failed to compute shared secret: ${error.message}`);
    }
  }

  storeSharedKey(userId, sharedKey) {
    this.sharedKeys.set(userId, sharedKey);
  }

  getSharedKey(userId) {
    return this.sharedKeys.get(userId);
  }

  hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  getPublicKeyHex() {
    return this.publicKey ? this.publicKey.toString(16) : null;
  }
}

export default DHKeyExchange;