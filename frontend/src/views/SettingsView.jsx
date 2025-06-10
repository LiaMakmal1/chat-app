import { THEMES } from "../constants";
import { themeState } from "../state/themeState";
import { Send, Palette, Sparkles, Check, MessageSquare } from "lucide-react";

// Sample chat messages for preview
const msgs = [
  { id: 1, content: "Hey! How's it going?", isSent: false },
  { id: 2, content: "I'm great!! I'm watching the new episode of Friends now", isSent: true },
];

const SettingsView = () => {
  const { theme, setTheme } = themeState();

  // Generate theme options
  const themes = THEMES.reduce((acc, t) => {
    acc.push(
      <button
        key={t}
        className={`group flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
          theme === t 
            ? "bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-base-100" 
            : "hover:bg-base-200 border border-base-300"
        }`}
        onClick={() => setTheme(t)}
      >
        <div className="relative h-10 w-full rounded-lg overflow-hidden shadow-sm" data-theme={t}>
          <div className="absolute inset-0 grid grid-cols-4 gap-px p-1">
            <div className="bg-primary rounded" />
            <div className="bg-secondary rounded" />
            <div className="bg-accent rounded" />
            <div className="bg-neutral rounded" />
          </div>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-xs font-medium">
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </span>
          {theme === t && <Check className="size-3 text-primary" />}
        </div>
      </button>
    );
    return acc;
  }, []);

  // Message bubble renderer
  const bubble = (msg) => {
    const position = msg.isSent ? "justify-end" : "justify-start";
    const style = msg.isSent
      ? "bg-primary text-primary-content"
      : "bg-base-200 text-base-content";

    return (
      <div key={msg.id} className={`flex ${position}`}>
        <div className={`max-w-[80%] rounded-xl p-3 shadow-sm ${style}`}>
          <p className="text-sm">{msg.content}</p>
          <p className={`text-[10px] mt-1.5 ${msg.isSent ? "text-primary-content/70" : "text-base-content/70"}`}>
            12:01 PM
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-base-100 pt-20">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Page header */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold mb-2">Personalize Your Experience</h1>
          <p className="text-base-content/70 max-w-xl mx-auto">
            Customize the appearance of Chatty to match your style and preferences
          </p>
        </div>

        <div className="grid md:grid-cols-5 gap-8">
          {/* Left column - Theme selection */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-base-200 rounded-2xl p-6 shadow-sm">
              <header className="flex items-center gap-2 mb-4">
                <Palette className="size-5 text-primary" />
                <h2 className="text-xl font-semibold">Choose Theme</h2>
              </header>

              <p className="text-sm text-base-content/70 mb-4">
                Select a theme that suits your mood and style
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {themes}
              </div>
            </div>

            <div className="bg-base-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-5 text-primary" />
                  <h2 className="text-xl font-semibold">Active Theme</h2>
                </div>
                <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                  {theme.charAt(0).toUpperCase() + theme.slice(1)}
                </div>
              </div>

              <p className="text-sm text-base-content/70">
                Your selected theme will be applied across all your devices when you're logged in
              </p>
            </div>
          </div>

          {/* Right column - Preview */}
          <div className="md:col-span-3">
            <div className="bg-base-200 rounded-2xl p-6 shadow-sm">
              <header className="flex items-center gap-2 mb-4">
                <MessageSquare className="size-5 text-primary" />
                <h2 className="text-xl font-semibold">Live Preview</h2>
              </header>

              <div className="rounded-xl overflow-hidden border border-base-300 shadow-md">
                {/* Mock chat UI */}
                <div className="bg-base-100 overflow-hidden">
                  {/* Chat header */}
                  <div className="px-4 py-3 border-b border-base-300 bg-base-100">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-full bg-primary flex items-center justify-center text-primary-content font-medium">
                        A
                      </div>
                      <div>
                        <h3 className="font-medium">Alex Chen</h3>
                        <p className="text-xs text-base-content/70">Online</p>
                      </div>
                    </div>
                  </div>

                  {/* Messages area */}
                  <div className="p-4 space-y-4 min-h-[250px] max-h-[250px] overflow-y-auto bg-base-100">
                    <p className="text-center text-xs text-base-content/60 italic mb-2">
                      Preview how your messages will look with this theme
                    </p>
                    {msgs.map(bubble)}
                  </div>

                  {/* Input area */}
                  <div className="p-4 border-t border-base-300 bg-base-100">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="input input-bordered flex-1 text-sm"
                        placeholder="Type a message..."
                        value="This is a preview"
                        readOnly
                      />
                      <button
                        className="btn btn-primary"
                        onClick={() => console.log("Preview mode")}
                      >
                        <Send className="size-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
