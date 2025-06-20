// components/ChatView.jsx - Simplified from complex state management
import { useEffect, useRef } from "react";
import { chatState } from "../state/chatState";
import { authState } from "../state/authState";
import { formatMessageTime } from "../lib/utils";
import ChatHeader from "./ChatBar";
import MessageInput from "./ChatInput";
import ChatLoading from "./skeletons/ChatLoading";

const Message = ({ message, isOwn, selectedUser, authUser }) => (
  <div className={`chat ${isOwn ? "chat-end" : "chat-start"}`}>
    <div className="chat-image avatar">
      <div className="size-10 rounded-full border">
        <img
          src={isOwn ? authUser.avatar || "/avatar.png" : selectedUser.avatar || "/avatar.png"}
          alt="profile"
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
      {message.text && message.text !== "[Encrypted]" && message.text.trim() !== "" && (
        <p>{message.text}</p>
      )}
      {message.text === "[Encrypted]" && (
        <p className="italic text-gray-500">🔒 Encrypted message</p>
      )}
    </div>
  </div>
);

const ChatView = () => {
  const { messages, selectedUser, loading } = chatState();
  const { authUser } = authState();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (loading.messages) {
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
        {messages.length > 0 ? (
          messages.map((message) => (
            <Message
              key={message._id}
              message={message}
              isOwn={message.fromUserId === authUser._id}
              selectedUser={selectedUser}
              authUser={authUser}
            />
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-base-content/60">
              <p className="text-lg mb-2">No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatView;