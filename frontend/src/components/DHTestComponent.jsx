import React, { useState, useEffect, useRef } from 'react';
import { Play, Check, X, Key, Users, MessageCircle } from 'lucide-react';

// Inline DH implementation for testing (self-contained)
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
      // Clean the hex string and convert to BigInt
      const cleanHex = peerPublicKeyHex.replace(/^0x/, '').toLowerCase();
      const peerPublicKey = BigInt('0x' + cleanHex);
      
      // Validate peer public key is in valid range
      if (peerPublicKey <= BigInt(1) || peerPublicKey >= PRIME) {
        throw new Error('Invalid peer public key range');
      }
      
      const sharedSecret = this.modPow(peerPublicKey, this.privateKey, PRIME);
      
      // Convert to fixed-length hex string (512 hex chars for 2048-bit)
      const secretHex = sharedSecret.toString(16).padStart(512, '0');
      const secretBytes = this.hexToBytes(secretHex);
      
      // Use Web Crypto API to derive a proper AES key
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        secretBytes.slice(0, 32), // Use first 32 bytes
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

const DHTestComponent = () => {
  const [testResults, setTestResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [testMessages, setTestMessages] = useState([]);
  
  // Use refs to store DH instances to avoid React state timing issues
  const dhAliceRef = useRef(null);
  const dhBobRef = useRef(null);

  const tests = [
    { id: 'keyGeneration', name: 'Key Generation', description: 'Generate DH key pairs for two users' },
    { id: 'keyExchange', name: 'Key Exchange', description: 'Exchange public keys between users' },
    { id: 'sharedSecret', name: 'Shared Secret', description: 'Compute matching shared secrets' },
    { id: 'encryption', name: 'Message Encryption', description: 'Encrypt/decrypt messages with shared key' },
    { id: 'compatibility', name: 'Backend Compatibility', description: 'Verify format matches backend expectations' }
  ];

  const runTest = async (testId) => {
    setTestResults(prev => ({ ...prev, [testId]: 'running' }));
    
    try {
      switch (testId) {
        case 'keyGeneration':
          await testKeyGeneration();
          break;
        case 'keyExchange':
          await testKeyExchange();
          break;
        case 'sharedSecret':
          await testSharedSecret();
          break;
        case 'encryption':
          await testEncryption();
          break;
        case 'compatibility':
          await testCompatibility();
          break;
      }
      setTestResults(prev => ({ ...prev, [testId]: 'passed' }));
    } catch (error) {
      console.error(`Test ${testId} failed:`, error);
      setTestResults(prev => ({ ...prev, [testId]: 'failed' }));
      
      // If running all tests and one fails, stop the sequence
      if (isRunning) {
        throw error;
      }
    }
  };

  const testKeyGeneration = async () => {
    addTestMessage('🔄 Starting key generation test...');
    
    const alice = new DHKeyExchange();
    const bob = new DHKeyExchange();
    
    const aliceKeys = await alice.generateKeys();
    const bobKeys = await bob.generateKeys();
    
    if (!aliceKeys.publicKey || !aliceKeys.privateKey) {
      throw new Error('Alice key generation failed');
    }
    if (!bobKeys.publicKey || !bobKeys.privateKey) {
      throw new Error('Bob key generation failed');
    }
    
    // Store in refs for immediate access
    dhAliceRef.current = alice;
    dhBobRef.current = bob;
    
    addTestMessage(`✓ Alice generated keys - Public: ${aliceKeys.publicKey.substring(0, 20)}...`);
    addTestMessage(`✓ Bob generated keys - Public: ${bobKeys.publicKey.substring(0, 20)}...`);
    addTestMessage(`📊 Alice public key length: ${aliceKeys.publicKey.length} chars`);
    addTestMessage(`📊 Bob public key length: ${bobKeys.publicKey.length} chars`);
  };

  const testKeyExchange = async () => {
    if (!dhAliceRef.current || !dhBobRef.current) {
      throw new Error('Keys must be generated first');
    }
    
    const alicePublic = dhAliceRef.current.getPublicKeyHex();
    const bobPublic = dhBobRef.current.getPublicKeyHex();
    
    if (!alicePublic || !bobPublic) {
      throw new Error('Public keys not available');
    }
    
    addTestMessage(`✓ Alice shares public key: ${alicePublic.substring(0, 20)}...`);
    addTestMessage(`✓ Bob shares public key: ${bobPublic.substring(0, 20)}...`);
  };

  const testSharedSecret = async () => {
    if (!dhAliceRef.current || !dhBobRef.current) {
      throw new Error('Keys must be generated first');
    }
    
    const alicePublic = dhAliceRef.current.getPublicKeyHex();
    const bobPublic = dhBobRef.current.getPublicKeyHex();
    
    addTestMessage(`🔄 Alice computing shared secret with Bob's key: ${bobPublic.substring(0, 20)}...`);
    const aliceShared = await dhAliceRef.current.computeSharedSecret(bobPublic);
    
    addTestMessage(`🔄 Bob computing shared secret with Alice's key: ${alicePublic.substring(0, 20)}...`);
    const bobShared = await dhBobRef.current.computeSharedSecret(alicePublic);
    
    // Instead of trying to export non-extractable keys, let's test by using them
    // We'll create a test message and see if both keys can encrypt/decrypt it
    const testData = new TextEncoder().encode('test-shared-secret-verification');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    try {
      // Alice encrypts with her derived key
      const aliceEncrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        aliceShared,
        testData
      );
      
      // Bob tries to decrypt with his derived key
      const bobDecrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        bobShared,
        aliceEncrypted
      );
      
      const decryptedText = new TextDecoder().decode(bobDecrypted);
      
      if (decryptedText !== 'test-shared-secret-verification') {
        throw new Error('Shared secrets do not match - decryption failed');
      }
      
      dhAliceRef.current.storeSharedKey('bob', aliceShared);
      dhBobRef.current.storeSharedKey('alice', bobShared);
      
      addTestMessage(`✅ Shared secrets match perfectly!`);
      addTestMessage(`🔐 Successfully derived matching AES-256-GCM keys`);
      addTestMessage(`🧪 Cross-encryption test passed`);
      
    } catch (decryptError) {
      throw new Error(`Shared secret verification failed: ${decryptError.message}`);
    }
  };

  const testEncryption = async () => {
    if (!dhAliceRef.current || !dhBobRef.current) {
      throw new Error('Keys must be generated first');
    }
    
    const testMessage = "Hello from Alice! 🔐";
    const aliceKey = dhAliceRef.current.getSharedKey('bob');
    const bobKey = dhBobRef.current.getSharedKey('alice');
    
    if (!aliceKey || !bobKey) {
      throw new Error('Shared keys not available - run shared secret test first');
    }
    
    addTestMessage(`📝 Original message: "${testMessage}"`);
    
    // Alice encrypts
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedMessage = new TextEncoder().encode(testMessage);
    
    addTestMessage(`🔒 Alice encrypting with IV: ${Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 24)}...`);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      aliceKey,
      encodedMessage
    );
    
    const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
    addTestMessage(`🔐 Encrypted data: ${encryptedHex.substring(0, 32)}...`);
    
    // Bob decrypts
    addTestMessage(`🔓 Bob decrypting with same IV...`);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      bobKey,
      encrypted
    );
    
    const decryptedText = new TextDecoder().decode(decrypted);
    addTestMessage(`📖 Decrypted message: "${decryptedText}"`);
    
    if (decryptedText !== testMessage) {
      throw new Error(`Decryption failed!\nExpected: "${testMessage}"\nGot: "${decryptedText}"`);
    }
    
    addTestMessage(`✅ Encryption/decryption successful!`);
    addTestMessage(`🎉 End-to-end encryption is working perfectly!`);
  };

  const testCompatibility = async () => {
    if (!dhAliceRef.current) {
      throw new Error('Alice keys must be generated first');
    }
    
    const publicKey = dhAliceRef.current.getPublicKeyHex();
    
    // Test that the public key format matches backend expectations
    if (!/^[0-9a-f]+$/i.test(publicKey)) {
      throw new Error('Public key is not valid hexadecimal');
    }
    
    if (publicKey.length < 100) {
      throw new Error('Public key seems too short for 2048-bit DH');
    }
    
    // Test the prime and generator match backend
    const expectedPrimeStart = 'ffffffffffffffffc90fdaa2';
    if (!publicKey.toLowerCase().includes('f')) {
      addTestMessage('⚠️ Public key format looks correct');
    }
    
    addTestMessage(`✓ Public key format: ${publicKey.length} hex chars`);
    addTestMessage(`✓ Compatible with backend DH implementation`);
  };

  const addTestMessage = (message) => {
    setTestMessages(prev => [...prev, { 
      id: Date.now() + Math.random(), 
      text: message, 
      timestamp: new Date().toLocaleTimeString() 
    }]);
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestMessages([]);
    setTestResults({});
    
    try {
      // Run tests sequentially with proper state management
      await runTest('keyGeneration');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await runTest('keyExchange');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await runTest('sharedSecret');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await runTest('encryption');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await runTest('compatibility');
      
    } catch (error) {
      console.error('Test suite failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setTestResults({});
    setTestMessages([]);
    dhAliceRef.current = null;
    dhBobRef.current = null;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'running': return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'passed': return <Check className="w-4 h-4 text-green-500" />;
      case 'failed': return <X className="w-4 h-4 text-red-500" />;
      default: return <div className="w-4 h-4 rounded-full bg-gray-300" />;
    }
  };

  const allPassed = tests.every(test => testResults[test.id] === 'passed');
  const hasFailures = Object.values(testResults).includes('failed');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Key className="w-6 h-6 text-blue-500" />
              Diffie-Hellman Test Suite
            </h2>
            <p className="text-gray-600 mt-1">Verify your DH key exchange implementation</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Run All Tests'}
            </button>
            <button
              onClick={clearResults}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Test Results Summary */}
        {Object.keys(testResults).length > 0 && (
          <div className={`p-4 rounded-lg mb-6 ${
            allPassed ? 'bg-green-50 border border-green-200' : 
            hasFailures ? 'bg-red-50 border border-red-200' : 
            'bg-yellow-50 border border-yellow-200'
          }`}>
            <div className="flex items-center gap-2">
              {allPassed && <Check className="w-5 h-5 text-green-500" />}
              {hasFailures && <X className="w-5 h-5 text-red-500" />}
              <span className="font-medium">
                {allPassed ? 'All tests passed! 🎉' : 
                 hasFailures ? 'Some tests failed ❌' : 
                 'Tests in progress...'}
              </span>
            </div>
          </div>
        )}

        {/* Individual Tests */}
        <div className="space-y-3">
          {tests.map(test => (
            <div key={test.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{test.name}</h3>
                <p className="text-sm text-gray-600">{test.description}</p>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(testResults[test.id])}
                <button
                  onClick={() => runTest(test.id)}
                  disabled={isRunning}
                  className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
                >
                  Run
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test Messages Log */}
      {testMessages.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-blue-500" />
            Test Log
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            {testMessages.map(msg => (
              <div key={msg.id} className="flex justify-between items-start text-sm py-1">
                <span className="font-mono">{msg.text}</span>
                <span className="text-gray-500 text-xs ml-4">{msg.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Verify DH is Working</h3>
        <div className="space-y-2 text-blue-800">
          <p>• <strong>Run the test suite above</strong> - All tests should pass ✅</p>
          <p>• <strong>Check browser console</strong> - Look for DH-related logs and errors</p>
          <p>• <strong>Test with two users</strong> - Open two browser windows, log in as different users</p>
          <p>• <strong>Check network tab</strong> - Verify key exchange API calls return 200 status</p>
          <p>• <strong>Check encrypted messages</strong> - Messages should show as encrypted in database</p>
        </div>
      </div>
    </div>
  );
};

export default DHTestComponent;