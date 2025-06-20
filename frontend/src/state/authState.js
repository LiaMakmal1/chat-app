import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { io } from "socket.io-client";
import toast from "react-hot-toast";

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
      const { data } = await axiosInstance.get("/auth/check");
      set({ authUser: data });
      get().connectSocket();
      
      // Initialize chat state after auth
      const { chatState } = await import('./chatState.js');
      chatState.getState().initialize();
    } catch (error) {
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const { data: user } = await axiosInstance.post("/auth/signup", data);
      set({ authUser: user });
      toast.success("Account created successfully");
      get().connectSocket();
      
      const { chatState } = await import('./chatState.js');
      chatState.getState().initialize();
    } catch (error) {
      toast.error(error.response?.data?.message || "Signup failed");
    } finally {
      set({ isSigningUp: false });
    }
  },

  signIn: async (data) => {
    set({ isLoggingIn: true });
    try {
      const { data: user } = await axiosInstance.post("/auth/signIn", data);
      set({ authUser: user });
      toast.success("Logged in successfully");
      get().connectSocket();
      
      const { chatState } = await import('./chatState.js');
      chatState.getState().initialize();
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  signOut: async () => {
    try {
      await axiosInstance.post("/auth/signOut");
      
      // Clear chat state first
      const { chatState } = await import('./chatState.js');
      chatState.getState().reset();
      
      get().disconnectSocket();
      set({ authUser: null, onlineUsers: [] });
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Logout failed");
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const { data: user } = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: user });
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error(error.response?.data?.message || "Update failed");
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser, socket } = get();
    if (!authUser || socket?.connected) return;

    const newSocket = io(BASE_URL, {
      query: { userId: authUser._id },
    });

    newSocket.on('connect', () => {
      set({ socket: newSocket });
      
      // Setup chat socket listeners
      const { chatState } = import('./chatState.js').then(module => {
        module.chatState.getState().setupSocket();
      });
    });

    newSocket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket?.connected) {
      // Cleanup chat listeners first
      import('./chatState.js').then(module => {
        module.chatState.getState().cleanupSocket();
      });
      
      socket.disconnect();
      set({ socket: null });
    }
  },
}));