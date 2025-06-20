import { chatState } from "../state/chatState";
import { useEffect, useState, useRef } from "react";

import ChatHeader from "./ChatBar";
import MessageInput from "./ChatInput";
import ChatLoading from "./skeletons/ChatLoading";
import { authState } from "../state/authState";
import { formatMessageTime } from "../lib/utils";

const ChatView = () => {
  const {
    messages,
    history,
    msgsLoading,
    selectedUser,
    syncMsgs,
    offMessages,
  } = chatState();
  const { authUser } = authState();
  const msgEndRef = useRef(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Debug: Track effect executions
  const effectRunCount = useRef(0);
  const lastSelectedUserId = useRef(null);

  useEffect(() => {
    effectRunCount.current++;
    const currentRun = effectRunCount.current;
    
    console.log(`🎬 ChatView useEffect #${currentRun} triggered`);
    console.log(`📊 Effect context:`, {
      selectedUserId: selectedUser?._id,
      selectedUserName: selectedUser?.fullName,
      previousUserId: lastSelectedUserId.current,
      messagesCount: messages?.length || 0,
      effectRunCount: currentRun
    });

    if (!selectedUser) {
      console.log(`⏭️ Effect #${currentRun}: No selected user, skipping`);
      return;
    }

    // Check if this is the same user as before
    const isSameUser = lastSelectedUserId.current === selectedUser._id;
    lastSelectedUserId.current = selectedUser._id;

    if (isSameUser) {
      console.log(`⏭️ Effect #${currentRun}: Same user selected, skipping duplicate setup`);
      return;
    }
    
    const loadChatHistory = async () => {
      setIsLoadingHistory(true);
      try {
        console.log(`📚 Effect #${currentRun}: Loading chat history for:`, selectedUser.fullName);
        await history(selectedUser._id);
        
        console.log(`🔄 Effect #${currentRun}: Setting up message sync for:`, selectedUser.fullName);
        syncMsgs();
      } catch (error) {
        console.error(`❌ Effect #${currentRun}: Failed to load chat history:`, error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadChatHistory();

    // Cleanup function
    return () => {
      console.log(`🧹 Effect #${currentRun}: Cleanup for user:`, selectedUser.fullName);
      offMessages();
    };
  }, [selectedUser?._id, history, syncMsgs, offMessages]); // Only depend on user ID change

  // Separate effect for scrolling to prevent unnecessary re-renders
  useEffect(() => {
    if (msgEndRef.current && messages && messages.length > 0) {
      console.log(`📜 Scrolling to bottom, messages count: ${messages.length}`);
      msgEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Debug: Log messages changes
  useEffect(() => {
    console.log(`📨 Messages state changed:`, {
      count: messages?.length || 0,
      selectedUser: selectedUser?.fullName,
      lastMessage: messages?.[messages.length - 1]
    });
  }, [messages, selectedUser?.fullName]);

  // Show loading while checking auth or loading history
  if (msgsLoading || isLoadingHistory) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <ChatLoading />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages && messages.length > 0 ? (
          messages.map((message, index) => {
            // Debug: Check for duplicate messages in render
            const duplicateIndex = messages.findIndex((m, i) => i !== index && m._id === message._id);
            if (duplicateIndex !== -1) {
              console.warn(`🚨 DUPLICATE MESSAGE IN RENDER:`, {
                messageId: message._id,
                currentIndex: index,
                duplicateIndex: duplicateIndex,
                text: message.text?.substring(0, 20)
              });
            }

            return (
              <div
                key={`${message._id}-${message.createdAt}-${index}`} // Enhanced key to prevent React issues
                className={`chat ${message.fromUserId === authUser._id ? "chat-end" : "chat-start"}`}
              >
                <div className="chat-image avatar">
                  <div className="size-10 rounded-full border">
                    <img
                      src={
                        message.fromUserId === authUser._id
                          ? authUser.avatar || "/avatar.png"
                          : selectedUser.avatar || "/avatar.png"
                      }
                      alt="profile pic"
                    />
                  </div>
                </div>
                <div className="chat-header mb-1">
                  <time className="text-xs opacity-50 ml-1">
                    {formatMessageTime(message.createdAt)}
                  </time>
                </div>
                <div className="chat-bubble flex flex-col">
                  {message.image && (
                    <img
                      src={message.image}
                      alt="Attachment"
                      className="sm:max-w-[200px] rounded-md mb-2"
                    />
                  )}
                  {message.text && message.text.trim() !== "" && message.text !== "[Encrypted]" && (
                    <p>{message.text}</p>
                  )}
                  {message.text === "[Encrypted]" && (
                    <p className="italic text-gray-500">🔒 Encrypted message</p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-base-content/60">
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">Start the conversation by sending a message!</p>
            </div>
          </div>
        )}
        <div ref={msgEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatView;