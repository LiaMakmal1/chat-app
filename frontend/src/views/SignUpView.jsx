import { useState } from "react";
import { authState } from "../state/authState";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, User, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import SidePattern from "../components/SidePattern";
import toast from "react-hot-toast";

const SignUpView = () => {
  const [showPwd, setShowPwd] = useState(false);
  const [data, setData] = useState({
    name: "",
    email: "",
    pwd: "",
  });

  const { signup, isSigningUp } = authState();

  const validate = () => {
    if (!data.name.trim()) return toast.error("Full name is required");
    if (!data.email.trim()) return toast.error("Email is required");
    if (!/\S+@\S+\.\S+/.test(data.email)) return toast.error("Invalid email format");
    if (!data.pwd) return toast.error("Password is required");
    if (data.pwd.length < 6) return toast.error("Password must be at least 6 characters");

    return true;
  };

  const submit = (e) => {
    e.preventDefault();
    const valid = validate();
    if (valid === true) signup({
      fullName: data.name,
      email: data.email,
      password: data.pwd
    });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-base-100">
      {/* Left side - Pattern */}
      <div className="hidden lg:flex lg:w-5/12 bg-base-200 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-base-200"></div>
        <div className="relative z-10 flex items-center justify-center w-full h-full p-12">
          <div className="max-w-md text-center">
            <div className="mb-8 flex justify-center">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageSquare className="size-8 text-primary" />
              </div>
            </div>
            <h2 className="text-4xl font-bold mb-4">Join Chatty</h2>
            <p className="text-lg text-base-content/70">
              Connect with friends, share moments, and build meaningful conversations in one place.
            </p>

            <div className="mt-12 p-6 bg-base-100/30 backdrop-blur-sm rounded-xl shadow-lg">
              <p className="italic text-base-content/80">
                "Chatty has transformed how our team communicates. It's intuitive and feature-rich!"
              </p>
              <p className="mt-4 font-semibold">— Sarah Johnson, Designer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Create your account</h1>
            <p className="mt-2 text-base-content/60">Fill in the details below to get started</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
            {/* Name field */}
            <div>
              <label className="block text-sm font-medium mb-2">Full Name</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <User className="size-5 text-primary/70" />
                </div>
                <input
                  type="text"
                  className="input input-bordered w-full pl-10 bg-base-200/50"
                  placeholder="John Doe"
                  value={data.name}
                  onChange={(e) => setData({ ...data, name: e.target.value })}
                />
              </div>
            </div>

            {/* Email field */}
            <div>
              <label className="block text-sm font-medium mb-2">Email Address</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Mail className="size-5 text-primary/70" />
                </div>
                <input
                  type="email"
                  className="input input-bordered w-full pl-10 bg-base-200/50"
                  placeholder="you@example.com"
                  value={data.email}
                  onChange={(e) => setData({ ...data, email: e.target.value })}
                />
              </div>
            </div>

            {/* Password field */}
            <div>
              <label className="block text-sm font-medium mb-2">Password</label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
                  <Lock className="size-5 text-primary/70" />
                </div>
                <input
                  type={showPwd ? "text" : "password"}
                  className="input input-bordered w-full pl-10 bg-base-200/50"
                  placeholder="••••••••"
                  value={data.pwd}
                  onChange={(e) => setData({ ...data, pwd: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPwd(!showPwd)}
                >
                  {showPwd ? (
                    <EyeOff className="size-5 text-base-content/40" />
                  ) : (
                    <Eye className="size-5 text-base-content/40" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button 
              type="submit" 
              className="btn btn-primary w-full mt-6 gap-2" 
              disabled={isSigningUp}
            >
              {isSigningUp ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Sign in link */}
          <div className="mt-8 text-center">
            <p className="text-base-content/70">
              Already have an account?{" "}
              <Link to="/signIn" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>

          {/* Terms */}
          <p className="mt-6 text-xs text-center text-base-content/50">
            By creating an account, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};
export default SignUpView;
