import { chatState } from "../state/chatState";

const TypingIndicator = () => {
  const { selectedUser, isUserTyping } = chatState();

  if (!selectedUser || !isUserTyping(selectedUser._id)) {
    return null;
  }

  return (
    <div className="px-4 py-2 flex items-center gap-3 text-sm text-base-content/70">
      <div className="flex items-center gap-1">
        <img
          src={selectedUser.avatar || "/avatar.png"}
          alt={selectedUser.fullName}
          className="size-6 rounded-full"
        />
        <span className="font-medium">{selectedUser.fullName}</span>
        <span>is typing</span>
      </div>
      
      {/* Animated dots */}
      <div className="flex gap-1">
        <div 
          className="w-2 h-2 bg-primary rounded-full animate-bounce" 
          style={{ animationDelay: '0ms' }}
        />
        <div 
          className="w-2 h-2 bg-primary rounded-full animate-bounce" 
          style={{ animationDelay: '150ms' }}
        />
        <div 
          className="w-2 h-2 bg-primary rounded-full animate-bounce" 
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
};

export default TypingIndicator;