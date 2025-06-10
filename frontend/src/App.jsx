// Main app component
// TODO: refactor this file

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
  const { authUser, checkAuth, isCheckingAuth, onlineUsers } = authState(); // Auth store state
  const { theme } = themeState(); // Theme store

  // FIXME: remove before production
  console.log({ onlineUsers });
  console.log({ authUser });
  console.log('App rendered at:', new Date().toISOString());

  // On app load, check if the user is already authenticated
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Show a loading spinner while checking authentication
  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );

  return (
    // Apply selected DaisyUI theme to the entire app
    <div data-theme={theme}>
      {/* Top navigation bar */}
      <Topbar />

      {/* Define application routes */}
      <Routes>
        {/* Private route: home/chat */}
        <Route path="/" element={authUser ? <HomeView /> : <Navigate to="/signIn" />} />

        {/* Public route: sign up */}
        <Route path="/signup" element={!authUser ? <SignUpView /> : <Navigate to="/" />} />

        {/* Public route: signIn */}
        <Route path="/signIn" element={!authUser ? <SignInView /> : <Navigate to="/" />} />

        {/* Settings page – accessible always */}
        <Route path="/settings" element={<SettingsView />} />

        {/* Private route: profile */}
        <Route path="/profile" element={authUser ? <ProfileView /> : <Navigate to="/signIn" />} />
      </Routes>

      {/* Global toast notification system */}
      <Toaster />
    </div>
  );
};

export default App;
