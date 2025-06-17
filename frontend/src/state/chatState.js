import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { authState } from "./authState";
import { socket } from "../socket"; 

import {
  generateDHKeyPair,
  exportPublicKey,
  importPeerPublicKey,
  deriveSharedKey
} from "../utils/dh";

let dhKeyPair = null; 
const sharedKeys = {};

export const chatState = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  msgsLoading: false,

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

  initializeDH: async () => {
    try {
      dhKeyPair = await generateDHKeyPair();
      const socketInstance = authState.getState().socket;
      const pubKeyRaw = await exportPublicKey(dhKeyPair.publicKey);
      const myId = authState.getState().user._id;

      socketInstance.emit("exchange-dh", {
        from: myId,
        publicKey: Array.from(pubKeyRaw), // Send as plain array
      });
    } catch (e) {
      console.error("DH init failed:", e);
    }
  },

  receiveDHKey: async (fromUserId, publicKeyBytes) => {
    try {
      const peerKey = await importPeerPublicKey(new Uint8Array(publicKeyBytes));
      const sharedKey = await deriveSharedKey(dhKeyPair.privateKey, peerKey);
      sharedKeys[fromUserId] = sharedKey;
      console.log("Shared key stored with", fromUserId);
    } catch (e) {
      console.error("Failed to derive shared key from", fromUserId, e);
    }
  },
  getSharedKeyForUser: (userId) => sharedKeys[userId] || null,

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
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  syncMsgs: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = authState.getState().socket;

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
  },

  setSelectedUser: (selectedUser) => set({ selectedUser }),
}));