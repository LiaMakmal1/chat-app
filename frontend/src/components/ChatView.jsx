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

  useEffect(() => {
    history(selectedUser._id);
    syncMsgs();
    return () => offMessages();
  }, [selectedUser._id, history, syncMsgs, offMessages]);

  useEffect(() => {
    if (msgEndRef.current && messages) {
      msgEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (msgsLoading) {
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
        {messages.map((message) => (
          <div
            key={message._id}
            className={`chat ${message.fromUserId === authUser._id ? "chat-end" : "chat-start"}`}
            ref={msgEndRef}
          >
            <div className=" chat-image avatar">
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
              {message.text && message.text.trim() !== "" && (
                <p>{message.text}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatView;