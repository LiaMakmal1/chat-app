import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { authState } from "./authState";
import DHKeyExchange from "../utils/dh";

// Global DH instance
let dhInstance = null;

export const chatState = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  msgsLoading: false,
  dhStatus: {}, // userId -> 'pending' | 'completed' | 'failed'

  getAccounts: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
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

      // Create new DH instance if needed
      if (!dhInstance) {
        dhInstance = new DHKeyExchange();
      }

      const keys = await dhInstance.generateKeys();
      console.log("Generated DH keys, public key:", keys.publicKey);

      // For now, simulate key exchange via socket (you can add HTTP endpoint later)
      const socket = authState.getState().socket;
      if (socket) {
        socket.emit("keyExchangeRequest", {
          targetUserId: selectedUser._id,
          publicKey: keys.publicKey,
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
      // Create DH instance if needed
      if (!dhInstance) {
        dhInstance = new DHKeyExchange();
        await dhInstance.generateKeys();
      }

      // Compute shared secret
      const sharedKey = await dhInstance.computeSharedSecret(publicKey);
      dhInstance.storeSharedKey(from, sharedKey);

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
    return dhInstance ? dhInstance.getSharedKey(userId) : null;
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
      // Check if we have a shared key and encrypt if available
      const sharedKey = get().getSharedKeyForUser(selectedUser._id);
      let dataToSend = { ...messageData };

      if (messageData.text && sharedKey) {
        // Encrypt the message
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedText = new TextEncoder().encode(messageData.text);
        
        const encrypted = await crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: iv
          },
          sharedKey,
          encodedText
        );

        dataToSend = {
          ...messageData,
          text: undefined, // Remove plain text
          encData: {
            cipherText: Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join(''),
            iv: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
            tag: '' // GCM includes auth tag in encrypted data
          }
        };
      }

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
}));