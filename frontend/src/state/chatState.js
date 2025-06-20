// state/chatState.js - Fixed imports and simplified logic
import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { cryptoManager } from "../lib/crypto";
import toast from "react-hot-toast";

export const chatState = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  loading: { users: false, messages: false },
  
  // Load all users except current user
  async getAccounts() {
    set(state => ({ loading: { ...state.loading, users: true } }));
    try {
      const { data } = await axiosInstance.get("/messages/users");
      set({ users: data });
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      set(state => ({ loading: { ...state.loading, users: false } }));
    }
  },

  // Load message history for selected user
  async history(userId) {
    if (!userId) return;
    
    set(state => ({ loading: { ...state.loading, messages: true } }));
    try {
      const { data } = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: data });
    } catch (error) {
      toast.error("Failed to load messages");
    } finally {
      set(state => ({ loading: { ...state.loading, messages: false } }));
    }
  },

  // Send message
  async sendMsg(messageData) {
    const { selectedUser, messages } = get();
    if (!selectedUser) return toast.error("No user selected");

    try {
      const { data } = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      
      // Check if message already exists in state (to prevent duplicates)
      const messageExists = messages.some(m => m._id === data._id);
      if (!messageExists) {
        set({ messages: [...messages, data] });
      }
    } catch (error) {
      toast.error("Failed to send message");
    }
  },

  // Set selected user and load their messages
  setSelectedUser(user) {
    const { selectedUser } = get();
    if (selectedUser?._id === user?._id) return; // Prevent unnecessary updates
    
    set({ selectedUser: user, messages: [] });
    if (user) get().history(user._id);
    
    // Save to session storage
    try {
      if (user) {
        sessionStorage.setItem('selectedUser', JSON.stringify(user));
      } else {
        sessionStorage.removeItem('selectedUser');
      }
    } catch (e) {} // Ignore storage errors
  },

  // Initialize key exchange
  async initializeDH() {
    const { selectedUser } = get();
    if (!selectedUser) return toast.error("No user selected");

    try {
      const publicKey = await cryptoManager.exportPublicKey();
      
      // Get socket from auth state
      const { authState } = await import('./authState');
      const socket = authState.getState().socket;
      
      if (socket) {
        socket.emit("keyExchangeRequest", {
          targetUserId: selectedUser._id,
          publicKey
        });
        toast.success("Key exchange initiated");
      }
    } catch (error) {
      console.error('DH initialization failed:', error);
      toast.error("Failed to initiate key exchange");
    }
  },

  // Handle incoming key exchange request
  async handleKeyExchangeRequest(data) {
    try {
      await cryptoManager.deriveSharedKey(data.publicKey, data.from);
      const myPublicKey = await cryptoManager.exportPublicKey();
      
      const { authState } = await import('./authState');
      const socket = authState.getState().socket;
      
      if (socket) {
        socket.emit("keyExchangeResponse", {
          targetUserId: data.from,
          publicKey: myPublicKey,
          accepted: true
        });
      }
      
      toast.success("Secure connection established");
    } catch (error) {
      console.error('Key exchange request failed:', error);
      toast.error("Key exchange failed");
    }
  },

  // Handle key exchange response
  async handleKeyExchangeResponse(data) {
    if (!data.accepted) return toast.error("Key exchange rejected");
    
    try {
      await cryptoManager.deriveSharedKey(data.publicKey, data.from);
      toast.success("Secure connection established");
    } catch (error) {
      console.error('Key exchange response failed:', error);
      toast.error("Key exchange failed");
    }
  },

  // Socket message handling with better deduplication
  addMessage(message) {
    const { messages, selectedUser } = get();
    
    // Check if message is relevant to current conversation
    const isRelevant = message.fromUserId === selectedUser?._id || message.toUserId === selectedUser?._id;
    if (!isRelevant) return;
    
    // Check for duplicates more thoroughly
    const isDuplicate = messages.some(m => 
      m._id === message._id || 
      (m.createdAt === message.createdAt && 
       m.fromUserId === message.fromUserId && 
       m.toUserId === message.toUserId &&
       m.text === message.text &&
       m.image === message.image)
    );
    
    if (!isDuplicate) {
      set({ messages: [...messages, message] });
    }
  },

  // Setup socket listeners
  setupSocket() {
    import('./authState').then(({ authState }) => {
      const socket = authState.getState().socket;
      if (!socket) return;

      socket.on("newMsg", get().addMessage);
      socket.on("keyExchangeRequest", get().handleKeyExchangeRequest);
      socket.on("keyExchangeResponse", get().handleKeyExchangeResponse);
    });
  },

  // Cleanup socket listeners
  cleanupSocket() {
    import('./authState').then(({ authState }) => {
      const socket = authState.getState().socket;
      if (!socket) return;

      socket.off("newMsg", get().addMessage);
      socket.off("keyExchangeRequest", get().handleKeyExchangeRequest);
      socket.off("keyExchangeResponse", get().handleKeyExchangeResponse);
    });
  },

  // Check if user has shared key
  getSharedKeyForUser(userId) {
    return cryptoManager.getSharedKey(userId);
  },

  // Initialize chat state
  async initialize() {
    await get().getAccounts();
    get().setupSocket();
    
    // Restore selected user from session
    try {
      const stored = sessionStorage.getItem('selectedUser');
      if (stored) {
        const user = JSON.parse(stored);
        const validUser = get().users.find(u => u._id === user._id);
        if (validUser) get().setSelectedUser(validUser);
      }
    } catch (e) {} // Ignore storage errors
  },

  // Reset state on logout
  reset() {
    get().cleanupSocket();
    sessionStorage.removeItem('selectedUser');
    cryptoManager.clearKeys();
    set({
      messages: [],
      users: [],
      selectedUser: null,
      loading: { users: false, messages: false }
    });
  }
}));