import { X, Lock, Unlock } from "lucide-react";
import { authState } from "../state/authState";
import { chatState } from "../state/chatState";

const ChatBar = () => {
  const { selectedUser, setSelectedUser, initializeDH, getSharedKeyForUser } = chatState();
  const { onlineUsers } = authState();

  if (!selectedUser) return null;

  const hasSharedKey = getSharedKeyForUser(selectedUser._id) !== null;

  const handleInitiateDH = () => {
    if (!hasSharedKey) {
      initializeDH();
    }
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img 
                src={selectedUser.avatar || "/avatar.png"} 
                alt={selectedUser.fullName} 
              />
            </div>
          </div>

          {/* User info */}
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">
              {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
            </p>
          </div>
        </div>

        {/* Encryption and close buttons */}
        <div className="flex items-center gap-2">
          {/* Encryption status button */}
          <button
            onClick={handleInitiateDH}
            className={`p-2 rounded-lg transition-colors ${
              hasSharedKey 
                ? 'text-green-600 bg-green-100 cursor-default' 
                : 'text-blue-600 hover:bg-blue-100'
            }`}
            title={
              hasSharedKey 
                ? 'End-to-end encryption is active' 
                : 'Click to initiate secure key exchange'
            }
          >
            {hasSharedKey ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>

          {/* Close button */}
          <button onClick={() => setSelectedUser(null)}>
            <X />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatBar;