import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { cryptoManager } from "../lib/crypto";
import toast from "react-hot-toast";

export const chatState = create((set, get) => ({
  messages: [], users: [], selectedUser: null,
  loading: { users: false, messages: false },
  typingUsers: new Set(),
  
  async getAccounts() {
    set(state => ({ loading: { ...state.loading, users: true } }));
    try {
      const { data } = await axiosInstance.get("/messages/users");
      set({ users: data });
    } catch (error) { toast.error("Failed to load users"); }
    finally { set(state => ({ loading: { ...state.loading, users: false } })); }
  },

  async history(userId) {
    if (!userId) return;
    set(state => ({ loading: { ...state.loading, messages: true } }));
    try {
      const { data } = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: data });
    } catch (error) { toast.error("Failed to load messages"); }
    finally { set(state => ({ loading: { ...state.loading, messages: false } })); }
  },

  async sendMsg(messageData) {
    const { selectedUser, messages } = get();
    if (!selectedUser) return toast.error("No user selected");
    try {
      const { data } = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      const messageExists = messages.some(m => m._id === data._id);
      if (!messageExists) set({ messages: [...messages, data] });
    } catch (error) { toast.error("Failed to send message"); }
  },

  // FIXED: Auto-initiate DH when selecting user
  setSelectedUser(user) {
    const { selectedUser } = get();
    if (selectedUser?._id === user?._id) return;
    
    set({ selectedUser: user, messages: [], typingUsers: new Set() });
    
    if (user) {
      get().history(user._id);
      
      // AUTO-INITIATE DH KEY EXCHANGE
      setTimeout(() => {
        if (!get().getSharedKeyForUser(user._id)) {
          console.log(`Auto-initiating DH key exchange with ${user.fullName}`);
          get().initializeDH();
        }
      }, 500); // Small delay to ensure socket is ready
    }
    
    try {
      if (user) sessionStorage.setItem('selectedUser', JSON.stringify(user));
      else sessionStorage.removeItem('selectedUser');
    } catch (e) {}
  },

  sendTypingIndicator(isTyping) {
    const { selectedUser } = get();
    if (!selectedUser) return;
    import('./authState').then(({ authState }) => {
      const socket = authState.getState().socket;
      if (socket) socket.emit("typing", { targetUserId: selectedUser._id, isTyping });
    });
  },

  handleUserTyping(data) {
    const { selectedUser, typingUsers } = get();
    if (!selectedUser || data.userId !== selectedUser._id) return;
    const newTypingUsers = new Set(typingUsers);
    data.isTyping ? newTypingUsers.add(data.userId) : newTypingUsers.delete(data.userId);
    set({ typingUsers: newTypingUsers });
  },

  isUserTyping: (userId) => get().typingUsers.has(userId),

  async initializeDH() {
    const { selectedUser } = get();
    if (!selectedUser) return;
    
    // Check if we already have a key
    if (get().getSharedKeyForUser(selectedUser._id)) {
      console.log(`DH key already exists for ${selectedUser.fullName}`);
      return;
    }
    
    try {
      console.log(`Initiating DH key exchange with ${selectedUser.fullName}`);
      const publicKey = await cryptoManager.exportPublicKey();
      const { authState } = await import('./authState');
      const socket = authState.getState().socket;
      if (socket) { 
        socket.emit("keyExchangeRequest", { targetUserId: selectedUser._id, publicKey }); 
        // Don't show toast for automatic key exchange
      }
    } catch (error) { 
      console.error("Failed to initiate automatic key exchange:", error);
    }
  },

  async handleKeyExchangeRequest(data) {
    try {
      console.log(`Received DH key exchange request from user ${data.from}`);
      await cryptoManager.deriveSharedKey(data.publicKey, data.from);
      const myPublicKey = await cryptoManager.exportPublicKey();
      const { authState } = await import('./authState');
      const socket = authState.getState().socket;
      if (socket) socket.emit("keyExchangeResponse", { targetUserId: data.from, publicKey: myPublicKey, accepted: true });
      console.log("DH key exchange completed successfully");
    } catch (error) { 
      console.error("Key exchange failed:", error);
    }
  },

  async handleKeyExchangeResponse(data) {
    if (!data.accepted) return console.log("Key exchange was rejected");
    try {
      console.log(`Received DH key exchange response from user ${data.from}`);
      await cryptoManager.deriveSharedKey(data.publicKey, data.from);
      console.log("DH key exchange completed successfully");
    } catch (error) { 
      console.error("Key exchange response failed:", error);
    }
  },

  addMessage(message) {
    const { messages, selectedUser } = get();
    const isRelevant = message.fromUserId === selectedUser?._id || message.toUserId === selectedUser?._id;
    if (!isRelevant) return;
    const isDuplicate = messages.some(m => m._id === message._id || 
      (m.createdAt === message.createdAt && m.fromUserId === message.fromUserId && m.toUserId === message.toUserId && m.text === message.text));
    if (!isDuplicate) set({ messages: [...messages, message] });
  },

  setupSocket() {
    import('./authState').then(({ authState }) => {
      const socket = authState.getState().socket;
      if (!socket) return;
      socket.on("newMsg", get().addMessage);
      socket.on("keyExchangeRequest", get().handleKeyExchangeRequest);
      socket.on("keyExchangeResponse", get().handleKeyExchangeResponse);
      socket.on("userTyping", get().handleUserTyping);
    });
  },

  cleanupSocket() {
    import('./authState').then(({ authState }) => {
      const socket = authState.getState().socket;
      if (!socket) return;
      socket.off("newMsg", get().addMessage); socket.off("keyExchangeRequest", get().handleKeyExchangeRequest);
      socket.off("keyExchangeResponse", get().handleKeyExchangeResponse); socket.off("userTyping", get().handleUserTyping);
    });
  },

  getSharedKeyForUser: (userId) => cryptoManager.getSharedKey(userId),

  async initialize() {
    await get().getAccounts(); get().setupSocket();
    try {
      const stored = sessionStorage.getItem('selectedUser');
      if (stored) {
        const user = JSON.parse(stored);
        const validUser = get().users.find(u => u._id === user._id);
        if (validUser) get().setSelectedUser(validUser);
      }
    } catch (e) {}
  },

  reset() {
    get().cleanupSocket(); sessionStorage.removeItem('selectedUser'); cryptoManager.clearKeys();
    set({ messages: [], users: [], selectedUser: null, loading: { users: false, messages: false }, typingUsers: new Set() });
  }
}));