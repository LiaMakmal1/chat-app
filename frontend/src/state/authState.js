import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const authState = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      console.log('Checking authentication...');
      const res = await axiosInstance.get("/auth/check");
      console.log('Authentication successful for user:', res.data.fullName);
      
      set({ authUser: res.data });
      
      // Connect socket first
      await get().connectSocket();
      
      // Initialize chat state after authentication is confirmed
      const { chatState } = await import('./chatState.js');
      await chatState.getState().initializeChatState();
      
    } catch (error) {
      console.log("Authentication failed:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      
      await get().connectSocket();
      
      // Initialize chat state for new user
      const { chatState } = await import('./chatState.js');
      await chatState.getState().initializeChatState();
      
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  signIn: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/signIn", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully!");
      
      await get().connectSocket();
      
      // Initialize chat state after login
      const { chatState } = await import('./chatState.js');
      await chatState.getState().initializeChatState();
      
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  signOut: async () => {
    try {
      await axiosInstance.post("/auth/signOut");
      
      // Clear chat state before clearing auth
      const { chatState } = await import('./chatState.js');
      chatState.getState().clearDHState();
      
      set({ authUser: null });
      toast.success("Logged out successfully!");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    return new Promise((resolve) => {
      const { authUser } = get();
      if (!authUser || get().socket?.connected) {
        resolve();
        return;
      }

      console.log('Connecting socket for user:', authUser._id);
      
      const socket = io(BASE_URL, {
        query: {
          userId: authUser._id,
        },
      });
      
      socket.on('connect', () => {
        console.log('Socket connected successfully');
        set({ socket: socket });
        resolve();
      });

      socket.on("getOnlineUsers", (userIds) => {
        console.log('Online users updated:', userIds.length);
        set({ onlineUsers: userIds });
      });

      // Import chatState for DH handling
      socket.on("receive-dh", (data) => {
        import('./chatState.js').then(({ chatState }) => {
          chatState.getState().receiveDHKey(data.fromUserId, data.publicKey);
        });
      });

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        resolve(); // Don't block on socket errors
      });

      // Fallback timeout
      setTimeout(() => {
        if (!socket.connected) {
          console.warn('Socket connection timeout, continuing anyway');
        }
        resolve();
      }, 5000);
    });
  },
  
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket?.connected) {
      console.log('Disconnecting socket');
      socket.disconnect();
      set({ socket: null });
    }
  },
}));