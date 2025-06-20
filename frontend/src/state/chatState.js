import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { authState } from "./authState";
import DHKeyExchange from "../utils/dh";

// Global DH instance
let dhInstance = null;

// Message deduplication helper
const MessageDeduplicator = {
  processedMessages: new Set(),
  
  isDuplicate: (messageId) => {
    if (MessageDeduplicator.processedMessages.has(messageId)) {
      console.warn(`🚨 Duplicate message detected: ${messageId}`);
      return true;
    }
    MessageDeduplicator.processedMessages.add(messageId);
    return false;
  },
  
  clear: () => {
    MessageDeduplicator.processedMessages.clear();
    console.log(`🧹 Message deduplicator cleared`);
  },
  
  cleanup: (validMessageIds) => {
    const oldSize = MessageDeduplicator.processedMessages.size;
    MessageDeduplicator.processedMessages = new Set(validMessageIds);
    console.log(`🧹 Deduplicator cleanup: ${oldSize} -> ${MessageDeduplicator.processedMessages.size}`);
  }
};

// Socket listener manager to prevent accumulation
const SocketListenerManager = {
  activeListeners: new Map(),
  
  register: (socket, eventName, handler, listenerId) => {
    // Remove existing listener if any
    SocketListenerManager.unregister(socket, eventName, listenerId);
    
    // Add new listener
    socket.on(eventName, handler);
    
    // Track it
    if (!SocketListenerManager.activeListeners.has(listenerId)) {
      SocketListenerManager.activeListeners.set(listenerId, new Map());
    }
    SocketListenerManager.activeListeners.get(listenerId).set(eventName, handler);
    
    console.log(`🔧 Registered ${eventName} listener for ${listenerId}`);
  },
  
  unregister: (socket, eventName, listenerId) => {
    const listenerMap = SocketListenerManager.activeListeners.get(listenerId);
    if (listenerMap && listenerMap.has(eventName)) {
      const handler = listenerMap.get(eventName);
      socket.off(eventName, handler);
      listenerMap.delete(eventName);
      
      if (listenerMap.size === 0) {
        SocketListenerManager.activeListeners.delete(listenerId);
      }
      
      console.log(`🗑️ Unregistered ${eventName} listener for ${listenerId}`);
    }
  },
  
  unregisterAll: (socket, listenerId) => {
    const listenerMap = SocketListenerManager.activeListeners.get(listenerId);
    if (listenerMap) {
      listenerMap.forEach((handler, eventName) => {
        socket.off(eventName, handler);
        console.log(`🗑️ Unregistered ${eventName} listener for ${listenerId}`);
      });
      SocketListenerManager.activeListeners.delete(listenerId);
    }
  },
  
  getActiveCount: () => {
    return Array.from(SocketListenerManager.activeListeners.values())
      .reduce((total, listenerMap) => total + listenerMap.size, 0);
  }
};

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

// Simple session storage helpers
const SessionStorage = {
  saveSelectedUser: (user) => {
    try {
      if (user) {
        sessionStorage.setItem('chatty_selected_user', JSON.stringify(user));
        console.log('💾 Saved selected user to session:', user.fullName);
      } else {
        sessionStorage.removeItem('chatty_selected_user');
      }
    } catch (error) {
      console.error('Failed to save selected user:', error);
    }
  },

  loadSelectedUser: () => {
    try {
      const stored = sessionStorage.getItem('chatty_selected_user');
      if (stored) {
        const user = JSON.parse(stored);
        console.log('📂 Loaded selected user from session:', user.fullName);
        return user;
      }
      return null;
    } catch (error) {
      console.error('Failed to load selected user:', error);
      return null;
    }
  },

  clearSelectedUser: () => {
    try {
      sessionStorage.removeItem('chatty_selected_user');
      console.log('🗑️ Cleared selected user from session');
    } catch (error) {
      console.error('Failed to clear selected user:', error);
    }
  }
};

export const chatState = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  msgsLoading: false,
  dhStatus: {},
  isInitialized: false,
  socketListenerId: null, // Track current listener session

  // Initialize the chat state - called after authentication is confirmed
  initializeChatState: async () => {
    const authUser = authState.getState().authUser;
    if (!authUser || get().isInitialized) return;

    console.log('🚀 Initializing chat state for user:', authUser._id);
    
    try {
      // Clear any existing state
      MessageDeduplicator.clear();
      
      // Load users first
      await get().getAccounts();
      
      // Initialize DH
      await get().initializeDHInstance();
      
      // Restore selected user from session if available
      const storedSelectedUser = SessionStorage.loadSelectedUser();
      if (storedSelectedUser) {
        const users = get().users;
        const validUser = users.find(u => u._id === storedSelectedUser._id);
        
        if (validUser) {
          console.log('🔄 Restoring selected user:', validUser.fullName);
          set({ selectedUser: validUser });
          await get().history(validUser._id);
        } else {
          SessionStorage.clearSelectedUser();
        }
      }
      
      set({ isInitialized: true });
    } catch (error) {
      console.error('❌ Failed to initialize chat state:', error);
    }
  },

  // Reset initialization state when user logs out
  resetChatState: () => {
    console.log('🔄 Resetting chat state');
    
    // Clear socket listeners
    const socket = authState.getState().socket;
    const listenerId = get().socketListenerId;
    if (socket && listenerId) {
      SocketListenerManager.unregisterAll(socket, listenerId);
    }
    
    SessionStorage.clearSelectedUser();
    MessageDeduplicator.clear();
    
    set({ 
      messages: [],
      users: [],
      selectedUser: null,
      isInitialized: false,
      dhStatus: {},
      socketListenerId: null
    });
  },

  // Initialize DH instance with stored keys if available
  initializeDHInstance: async () => {
    const authUser = authState.getState().authUser;
    if (!authUser) return;

    if (!dhInstance) {
      dhInstance = new DHKeyExchange();
      
      const storedKeys = await DHStorage.loadKeys(authUser._id);
      if (storedKeys) {
        dhInstance.privateKey = storedKeys.privateKey;
        dhInstance.publicKey = storedKeys.publicKey;
        dhInstance.sharedKeys = storedKeys.sharedKeys;
        console.log('🔑 Restored DH keys from storage');
      }
    }
  },

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
      console.log('👥 Fetching user accounts...');
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
      console.log('✅ Loaded users:', res.data.length);
    } catch (error) {
      console.error('❌ Failed to load users:', error);
      toast.error(error.response?.data?.message || 'Failed to load users');
    } finally {
      set({ isUsersLoading: false });
    }
  },

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

      await get().initializeDHInstance();
      
      if (!dhInstance.privateKey) {
        const keys = await dhInstance.generateKeys();
        console.log("🔑 Generated DH keys, public key:", keys.publicKey);
        get().saveDHState();
      }

      const socket = authState.getState().socket;
      if (socket) {
        socket.emit("keyExchangeRequest", {
          targetUserId: selectedUser._id,
          publicKey: dhInstance.getPublicKeyHex(),
          sessionId: `${authState.getState().authUser._id}-${selectedUser._id}`
        });
      }

      console.log("🔑 Key exchange initiated");
      toast.success("Key exchange initiated");

    } catch (error) {
      console.error("❌ DH initialization failed:", error);
      set({ 
        dhStatus: { 
          ...get().dhStatus, 
          [selectedUser._id]: 'failed' 
        } 
      });
      toast.error("Failed to initiate key exchange");
    }
  },

  handleKeyExchangeRequest: async (data) => {
    const { from, publicKey, sessionId } = data;
    
    try {
      await get().initializeDHInstance();
      
      if (!dhInstance.privateKey) {
        await dhInstance.generateKeys();
        get().saveDHState();
      }

      const sharedKey = await dhInstance.computeSharedSecret(publicKey);
      dhInstance.storeSharedKey(from, sharedKey);
      get().saveDHState();

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

      console.log("🔑 Key exchange completed with user:", from);
      toast.success("Secure connection established");

    } catch (error) {
      console.error("❌ Failed to handle key exchange request:", error);
      set({ 
        dhStatus: { 
          ...get().dhStatus, 
          [from]: 'failed' 
        } 
      });
    }
  },

  handleKeyExchangeResponse: async (data) => {
    const { sessionId, publicKey, accepted } = data;
    
    if (!accepted) {
      toast.error("Key exchange was rejected");
      return;
    }

    try {
      const sharedKey = await dhInstance.computeSharedSecret(publicKey);
      
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

      console.log("🔑 Key exchange completed with user:", otherUserId);
      toast.success("Secure connection established");

    } catch (error) {
      console.error("❌ Failed to complete key exchange:", error);
    }
  },

  getSharedKeyForUser: (userId) => {
    if (!dhInstance) return null;
    return dhInstance.getSharedKey(userId);
  },

  hasSharedKey: (userId) => {
    const status = get().dhStatus[userId];
    return status === 'completed' && dhInstance && dhInstance.getSharedKey(userId);
  },

  history: async (userId) => {
    if (!userId) {
      console.error('❌ Cannot load history: userId is required');
      return;
    }

    set({ msgsLoading: true });
    try {
      console.log('📚 Loading message history for user:', userId);
      const res = await axiosInstance.get(`/messages/${userId}`);
      console.log('✅ Loaded messages:', res.data.length);
      
      // Clear deduplicator and repopulate with valid message IDs
      MessageDeduplicator.clear();
      res.data.forEach(msg => MessageDeduplicator.processedMessages.add(msg._id));
      
      set({ messages: res.data });
    } catch (error) {
      console.error('❌ Failed to load message history:', error);
      toast.error(error.response?.data?.message || 'Failed to load message history');
    } finally {
      set({ msgsLoading: false });
    }
  },

  sendMsg: async (messageData) => {
    const { selectedUser, messages } = get();
    if (!selectedUser) {
      toast.error("No user selected");
      return;
    }

    try {
      const dataToSend = {
        text: messageData.text,
        image: messageData.image
      };

      console.log('📤 Sending message:', { to: selectedUser.fullName, text: messageData.text?.substring(0, 20) });
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, dataToSend);
      
      // Add to deduplicator to prevent duplicate from socket
      MessageDeduplicator.processedMessages.add(res.data._id);
      
      set({ messages: [...messages, res.data] });
      console.log('✅ Message sent and added to state');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      toast.error(error.response?.data?.message || 'Failed to send message');
    }
  },

  // FIXED: Proper socket message synchronization with deduplication
  syncMsgs: () => {
    const { selectedUser } = get();
    if (!selectedUser) {
      console.log('⏭️ syncMsgs: No selected user, skipping');
      return;
    }

    const socket = authState.getState().socket;
    if (!socket) {
      console.log('⏭️ syncMsgs: No socket connection, skipping');
      return;
    }

    // Clean up any existing listeners first
    const oldListenerId = get().socketListenerId;
    if (oldListenerId) {
      console.log('🧹 Cleaning up old socket listeners:', oldListenerId);
      SocketListenerManager.unregisterAll(socket, oldListenerId);
    }

    // Create new unique listener ID
    const newListenerId = `chat_${selectedUser._id}_${Date.now()}`;
    set({ socketListenerId: newListenerId });

    console.log('🔄 Setting up socket listeners for:', selectedUser.fullName, 'ID:', newListenerId);

    // Create message handler with deduplication
    const newMsgHandler = (newMsg) => {
      console.log('📨 Received socket message:', {
        messageId: newMsg._id,
        from: newMsg.fromUserId,
        to: newMsg.toUserId,
        text: newMsg.text?.substring(0, 20),
        selectedUserId: selectedUser._id,
        listenerId: newListenerId
      });

      // Check if message is for current conversation
      const isFromSelectedUser = newMsg.fromUserId === selectedUser._id;
      const isToSelectedUser = newMsg.toUserId === selectedUser._id;
      const isRelevant = isFromSelectedUser || isToSelectedUser;

      if (!isRelevant) {
        console.log('⏭️ Message not relevant to current conversation, ignoring');
        return;
      }

      // Check for duplicates using deduplicator
      if (MessageDeduplicator.isDuplicate(newMsg._id)) {
        console.warn('🚨 Duplicate message blocked:', newMsg._id);
        return;
      }

      // Double-check against current state (extra safety)
      const currentMessages = get().messages;
      const existsInState = currentMessages.some(msg => msg._id === newMsg._id);
      
      if (existsInState) {
        console.warn('🚨 Message already exists in state:', newMsg._id);
        return;
      }

      console.log('✅ Adding new message to state via socket');
      set({
        messages: [...currentMessages, newMsg],
      });
    };

    // Create key exchange handlers
    const keyExchangeRequestHandler = (data) => {
      console.log('🔑 Key exchange request received:', data);
      get().handleKeyExchangeRequest(data);
    };

    const keyExchangeResponseHandler = (data) => {
      console.log('🔑 Key exchange response received:', data);
      get().handleKeyExchangeResponse(data);
    };

    // Register all listeners with the manager
    SocketListenerManager.register(socket, "newMsg", newMsgHandler, newListenerId);
    SocketListenerManager.register(socket, "keyExchangeRequest", keyExchangeRequestHandler, newListenerId);
    SocketListenerManager.register(socket, "keyExchangeResponse", keyExchangeResponseHandler, newListenerId);

    console.log('✅ Socket listeners registered. Active listeners:', SocketListenerManager.getActiveCount());
  },

  // FIXED: Proper cleanup of socket listeners
  offMessages: () => {
    const socket = authState.getState().socket;
    const listenerId = get().socketListenerId;
    
    if (!socket || !listenerId) {
      console.log('⏭️ offMessages: No socket or listener ID, skipping cleanup');
      return;
    }

    console.log('🧹 Cleaning up socket listeners:', listenerId);
    SocketListenerManager.unregisterAll(socket, listenerId);
    set({ socketListenerId: null });
    
    console.log('✅ Socket cleanup complete. Active listeners:', SocketListenerManager.getActiveCount());
  },

  setSelectedUser: (selectedUser) => {
    console.log('👤 Setting selected user:', selectedUser?.fullName || 'null');
    
    // Clean up previous listeners before setting new user
    get().offMessages();
    
    set({ selectedUser });
    SessionStorage.saveSelectedUser(selectedUser);
    
    if (selectedUser) {
      console.log('📚 Loading history for selected user:', selectedUser.fullName);
      get().history(selectedUser._id);
    } else {
      // Clear messages when no user selected
      set({ messages: [] });
      MessageDeduplicator.clear();
    }
  },

  clearDHState: () => {
    const authUser = authState.getState().authUser;
    if (authUser) {
      DHStorage.clearKeys(authUser._id);
    }
    dhInstance = null;
    get().resetChatState();
  }
}));