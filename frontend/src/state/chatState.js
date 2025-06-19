import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { authState } from "./authState";
import DHKeyExchange from "../utils/dh";

// Global DH instance - but we need to persist keys across sessions
let dhInstance = null;

// Helper to store DH keys in localStorage for persistence
const DHStorage = {
  saveKeys: (userId, privateKey, publicKey, sharedKeys) => {
    try {
      const keyData = {
        privateKey: privateKey.toString(16),
        publicKey: publicKey.toString(16),
        sharedKeys: Array.from(sharedKeys.entries()).map(([id, key]) => [id, Array.from(new Uint8Array(key))])
      };
      localStorage.setItem(`dh_keys_${userId}`, JSON.stringify(keyData));
    } catch (error) {
      console.error('Failed to save DH keys:', error);
    }
  },

  loadKeys: async (userId) => {
    try {
      const stored = localStorage.getItem(`dh_keys_${userId}`);
      if (!stored) return null;
      
      const keyData = JSON.parse(stored);
      return {
        privateKey: BigInt('0x' + keyData.privateKey),
        publicKey: BigInt('0x' + keyData.publicKey),
        sharedKeys: new Map(keyData.sharedKeys.map(([id, keyArray]) => [
          id, 
          new Uint8Array(keyArray).buffer
        ]))
      };
    } catch (error) {
      console.error('Failed to load DH keys:', error);
      return null;
    }
  },

  clearKeys: (userId) => {
    localStorage.removeItem(`dh_keys_${userId}`);
  }
};

export const chatState = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  msgsLoading: false,
  dhStatus: {}, // userId -> 'pending' | 'completed' | 'failed'

  // Initialize DH instance with stored keys if available
  initializeDHInstance: async () => {
    const authUser = authState.getState().authUser;
    if (!authUser) return;

    if (!dhInstance) {
      dhInstance = new DHKeyExchange();
      
      // Try to restore keys from storage
      const storedKeys = await DHStorage.loadKeys(authUser._id);
      if (storedKeys) {
        dhInstance.privateKey = storedKeys.privateKey;
        dhInstance.publicKey = storedKeys.publicKey;
        dhInstance.sharedKeys = storedKeys.sharedKeys;
        console.log('Restored DH keys from storage');
      }
    }
  },

  // Save current DH state
  saveDHState: () => {
    const authUser = authState.getState().authUser;
    if (!authUser || !dhInstance) return;

    if (dhInstance.privateKey && dhInstance.publicKey) {
      DHStorage.saveKeys(
        authUser._id,
        dhInstance.privateKey,
        dhInstance.publicKey,
        dhInstance.sharedKeys
      );
    }
  },

  getAccounts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
      
      // Initialize DH instance when users are loaded
      await get().initializeDHInstance();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // Initialize DH key exchange with selected user
  initializeDH: async () => {
    const { selectedUser } = get();
    if (!selectedUser) {
      toast.error("No user selected for key exchange");
      return;
    }

    try {
      set({ 
        dhStatus: { 
          ...get().dhStatus, 
          [selectedUser._id]: 'pending' 
        } 
      });

      // Initialize DH instance if needed
      await get().initializeDHInstance();
      
      // Generate new keys if not already generated
      if (!dhInstance.privateKey) {
        const keys = await dhInstance.generateKeys();
        console.log("Generated DH keys, public key:", keys.publicKey);
        get().saveDHState();
      }

      // Send key exchange request via socket
      const socket = authState.getState().socket;
      if (socket) {
        socket.emit("keyExchangeRequest", {
          targetUserId: selectedUser._id,
          publicKey: dhInstance.getPublicKeyHex(),
          sessionId: `${authState.getState().authUser._id}-${selectedUser._id}`
        });
      }

      console.log("Key exchange initiated");
      toast.success("Key exchange initiated");

    } catch (error) {
      console.error("DH initialization failed:", error);
      set({ 
        dhStatus: { 
          ...get().dhStatus, 
          [selectedUser._id]: 'failed' 
        } 
      });
      toast.error("Failed to initiate key exchange");
    }
  },

  // Handle incoming key exchange request
  handleKeyExchangeRequest: async (data) => {
    const { from, publicKey, sessionId } = data;
    
    try {
      await get().initializeDHInstance();
      
      // Generate keys if not already generated
      if (!dhInstance.privateKey) {
        await dhInstance.generateKeys();
        get().saveDHState();
      }

      // Compute shared secret
      const sharedKey = await dhInstance.computeSharedSecret(publicKey);
      dhInstance.storeSharedKey(from, sharedKey);
      get().saveDHState();

      // Send response
      const socket = authState.getState().socket;
      if (socket) {
        socket.emit("keyExchangeResponse", {
          targetUserId: from,
          publicKey: dhInstance.getPublicKeyHex(),
          sessionId,
          accepted: true
        });
      }

      set({ 
        dhStatus: { 
          ...get().dhStatus, 
          [from]: 'completed' 
        } 
      });

      console.log("Key exchange completed with user:", from);
      toast.success("Secure connection established");

    } catch (error) {
      console.error("Failed to handle key exchange request:", error);
      set({ 
        dhStatus: { 
          ...get().dhStatus, 
          [from]: 'failed' 
        } 
      });
    }
  },

  // Handle key exchange response
  handleKeyExchangeResponse: async (data) => {
    const { sessionId, publicKey, accepted } = data;
    
    if (!accepted) {
      toast.error("Key exchange was rejected");
      return;
    }

    try {
      const sharedKey = await dhInstance.computeSharedSecret(publicKey);
      
      // Extract user ID from session ID
      const [userId1, userId2] = sessionId.split('-');
      const myId = authState.getState().authUser._id;
      const otherUserId = userId1 === myId ? userId2 : userId1;
      
      dhInstance.storeSharedKey(otherUserId, sharedKey);
      get().saveDHState();

      set({ 
        dhStatus: { 
          ...get().dhStatus, 
          [otherUserId]: 'completed' 
        } 
      });

      console.log("Key exchange completed with user:", otherUserId);
      toast.success("Secure connection established");

    } catch (error) {
      console.error("Failed to complete key exchange:", error);
    }
  },

  // Get shared key for a user
  getSharedKeyForUser: (userId) => {
    if (!dhInstance) return null;
    return dhInstance.getSharedKey(userId);
  },

  // Check if we have an active shared key
  hasSharedKey: (userId) => {
    const status = get().dhStatus[userId];
    return status === 'completed' && dhInstance && dhInstance.getSharedKey(userId);
  },

  history: async (userId) => {
    set({ msgsLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ msgsLoading: false });
    }
  },

  sendMsg: async (messageData) => {
    const { selectedUser, messages } = get();
    try {
      // The backend expects the standard format, so just send text normally
      // Backend will handle encryption if DH keys are available
      const dataToSend = {
        text: messageData.text,
        image: messageData.image
      };

      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, dataToSend);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  syncMsgs: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = authState.getState().socket;

    // Listen for key exchange events
    socket.on("keyExchangeRequest", get().handleKeyExchangeRequest);
    socket.on("keyExchangeResponse", get().handleKeyExchangeResponse);

    socket.on("newMsg", (newMsg) => {
      const isFromUser = newMsg.fromUserId === selectedUser._id;
      if (!isFromUser) return;

      set({
        messages: [...get().messages, newMsg],
      });
    });
  },

  offMessages: () => {
    const socket = authState.getState().socket;
    socket.off("newMsg");
    socket.off("keyExchangeRequest");
    socket.off("keyExchangeResponse");
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),

  // Clear DH state on logout
  clearDHState: () => {
    const authUser = authState.getState().authUser;
    if (authUser) {
      DHStorage.clearKeys(authUser._id);
    }
    dhInstance = null;
    set({ dhStatus: {} });
  }
}));