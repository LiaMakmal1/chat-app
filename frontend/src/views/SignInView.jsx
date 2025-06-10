import { useState } from "react";
import { authState } from "../state/authState";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, ArrowRight } from "lucide-react";

const SignInView = () => {
  const [showPwd, setShowPwd] = useState(false);
  const [data, setData] = useState({ 
    email: "", 
    pwd: ""
  });
  const { signIn, isLoggingIn } = authState();

  const submit = (e) => {
    e.preventDefault();
    signIn({
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
            <h2 className="text-4xl font-bold mb-4">Welcome Back</h2>
            <p className="text-lg text-base-content/70">
              Sign in to continue your conversations and catch up with your messages.
            </p>

            <div className="mt-12 p-6 bg-base-100/30 backdrop-blur-sm rounded-xl shadow-lg">
              <p className="italic text-base-content/80">
                "I love how easy it is to stay connected with my team using Chatty!"
              </p>
              <p className="mt-4 font-semibold">— Alex Chen, Developer</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Sign in</h1>
            <p className="mt-2 text-base-content/60">Welcome back! Please enter your details</p>
          </div>

          <form onSubmit={submit} className="space-y-5">
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
              disabled={isLoggingIn}
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          {/* Sign up link */}
          <div className="mt-8 text-center">
            <p className="text-base-content/70">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary font-medium hover:underline">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SignInView;
