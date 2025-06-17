export async function aesEncryptWithKey(plaintext, key) {
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(plaintext);
    
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      encodedText
    );

    return {
      cipherText: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join(''),
      iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('')
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt message');
  }
}

export async function aesDecryptWithKey(cipherTextHex, key, ivHex) {
  try {
    const cipherText = new Uint8Array(cipherTextHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      key,
      cipherText
    );

    const decryptedText = new TextDecoder().decode(decrypted);
    return decryptedText;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt message');
  }
}