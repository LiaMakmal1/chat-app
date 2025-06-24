import { X, Lock, Unlock, Loader } from "lucide-react";
import { authState } from "../state/authState";
import { chatState } from "../state/chatState";
import { useState, useEffect } from "react";

export default function ChatBar() {
  const { selectedUser, setSelectedUser, initializeDH, getSharedKeyForUser } = chatState();
  const { onlineUsers } = authState();
  const [isExchangingKeys, setIsExchangingKeys] = useState(false);

  if (!selectedUser) return null;

  const hasSharedKey = getSharedKeyForUser(selectedUser._id) !== null;

  // Check for key exchange in progress
  useEffect(() => {
    if (selectedUser && !hasSharedKey) {
      setIsExchangingKeys(true);
      // Check every 500ms if key exchange completed
      const checkInterval = setInterval(() => {
        if (getSharedKeyForUser(selectedUser._id)) {
          setIsExchangingKeys(false);
          clearInterval(checkInterval);
        }
      }, 500);
      
      // Stop checking after 10 seconds
      setTimeout(() => {
        setIsExchangingKeys(false);
        clearInterval(checkInterval);
      }, 10000);
      
      return () => clearInterval(checkInterval);
    } else {
      setIsExchangingKeys(false);
    }
  }, [selectedUser, hasSharedKey, getSharedKeyForUser]);

  const handleManualDH = () => {
    if (!hasSharedKey && !isExchangingKeys) {
      initializeDH();
      setIsExchangingKeys(true);
    }
  };

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <div className="size-10 rounded-full relative">
              <img src={selectedUser.avatar || "/avatar.png"} alt={selectedUser.fullName} />
            </div>
          </div>
          <div>
            <h3 className="font-medium">{selectedUser.fullName}</h3>
            <p className="text-sm text-base-content/70">{onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Enhanced encryption status */}
          <button
            onClick={handleManualDH}
            className={`p-2 rounded-lg transition-colors ${
              hasSharedKey 
                ? 'text-green-600 bg-green-100 cursor-default' 
                : isExchangingKeys
                ? 'text-blue-600 bg-blue-100 cursor-default'
                : 'text-orange-600 hover:bg-orange-100'
            }`}
            title={
              hasSharedKey 
                ? 'End-to-end encryption is active' 
                : isExchangingKeys
                ? 'Exchanging encryption keys...'
                : 'Click to retry key exchange'
            }
            disabled={hasSharedKey || isExchangingKeys}
          >
            {hasSharedKey ? (
              <Lock className="w-4 h-4" />
            ) : isExchangingKeys ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>
          <button onClick={() => setSelectedUser(null)}><X /></button>
        </div>
      </div>
      
      {/* Status indicator */}
      <div className="mt-2 text-xs text-center">
        {hasSharedKey && (
          <span className="text-green-600">🔒 End-to-end encrypted</span>
        )}
        {isExchangingKeys && (
          <span className="text-blue-600">🔄 Securing connection...</span>
        )}
        {!hasSharedKey && !isExchangingKeys && (
          <span className="text-orange-600">🔓 Using server encryption</span>
        )}
      </div>
    </div>
  );
}