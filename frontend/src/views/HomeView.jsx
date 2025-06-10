import { chatState } from "../state/chatState";
import UserList from "../components/UserPanel";
import EmptyChat from "../components/EmptyChat";
import ChatContainer from "../components/ChatView";

const HomeView = () => {
  const { selectedUser } = chatState();

  return (
    <div className="min-h-screen bg-base-200">
      <div className="flex items-center justify-center pt-20 px-4">
        <div className="bg-base-100 rounded-xl shadow-lg w-full max-w-6xl h-[calc(100vh-8rem)]">
          <div className="flex h-full rounded-xl overflow-hidden border border-base-300/50">
            <UserList />
            {!selectedUser ? <EmptyChat /> : <ChatContainer />}
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomeView;
