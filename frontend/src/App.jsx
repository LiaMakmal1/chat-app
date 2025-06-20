// App.jsx - Cleaned up imports and routes
import Topbar from "./components/Topbar";
import HomeView from "./views/HomeView";
import SignUpView from "./views/SignUpView";
import SignInView from "./views/SignInView";
import SettingsView from "./views/SettingsView";
import ProfileView from "./views/ProfileView";
import { Routes, Route, Navigate } from "react-router-dom";
import { authState } from "./state/authState";
import { themeState } from "./state/themeState";
import { useEffect } from "react";
import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth } = authState();
  const { theme } = themeState();

  // Check authentication on app load
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Show loading spinner while checking authentication
  if (isCheckingAuth && !authUser) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );
  }

  return (
    <div data-theme={theme}>
      <Topbar />
      
      <Routes>
        {/* Private route: home/chat */}
        <Route path="/" element={authUser ? <HomeView /> : <Navigate to="/signIn" />} />

        {/* Public routes */}
        <Route path="/signup" element={!authUser ? <SignUpView /> : <Navigate to="/" />} />
        <Route path="/signIn" element={!authUser ? <SignInView /> : <Navigate to="/" />} />

        {/* Settings page - accessible to all */}
        <Route path="/settings" element={<SettingsView />} />

        {/* Private route: profile */}
        <Route path="/profile" element={authUser ? <ProfileView /> : <Navigate to="/signIn" />} />
      </Routes>

      <Toaster />
    </div>
  );
};

export default App;