"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/trpc/react";
import { useParams, useRouter } from "next/navigation";
import { ChatMessage } from "@/components/chat-message";

interface ProfileContext {
  username: string;
  name: string;
  headline: string;
  location: string;
  summary: string;
}

export default function SimulatePage() {
  const params = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [profileContext, setProfileContext] = useState<ProfileContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const simulateMutation = api.chat.simulate.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      setThreadId(data.threadId);
    },
  });

  useEffect(() => {
    const sid = localStorage.getItem("seedSessionId");
    if (!sid) {
      router.push("/onboard");
      return;
    }
    setSessionId(sid);

    // Load profile context
    const storedProfile = localStorage.getItem("simulateProfile");
    if (!storedProfile) {
      router.push("/search");
      return;
    }

    const profile = JSON.parse(storedProfile) as ProfileContext;
    setProfileContext(profile);

    // Start conversation
    const greeting = `Hi ${profile.name.split(" ")[0]}! I saw your profile and thought we should connect.`;
    setMessages([{ role: "user", content: greeting }]);

    simulateMutation.mutate({
      message: greeting,
      sessionId: sid,
      profileUsername: params.username as string,
      profileContext: {
        name: profile.name,
        headline: profile.headline,
        location: profile.location,
        summary: profile.summary,
      },
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || simulateMutation.isPending || !profileContext) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");

    simulateMutation.mutate({
      message: userMessage,
      sessionId,
      profileUsername: params.username as string,
      profileContext: {
        name: profileContext.name,
        headline: profileContext.headline,
        location: profileContext.location,
        summary: profileContext.summary,
      },
      threadId: threadId || undefined,
    });
  };

  const handleBack = () => {
    router.push("/search");
  };

  if (!profileContext) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header with Profile Info */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="mb-2 flex items-center gap-2">
            <button
              onClick={handleBack}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back to Search
            </button>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">💬 Networking Simulation</h1>
              <p className="text-sm text-muted-foreground">
                Practice your pitch with {profileContext.name}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-sm font-semibold">{profileContext.name}</p>
              <p className="text-xs text-muted-foreground">{profileContext.headline}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <span>📍</span>
                <span>{profileContext.location}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-3xl px-4 py-8">
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx}>
                {msg.role === "assistant" && (
                  <p className="mb-1 ml-1 text-xs font-semibold text-muted-foreground">
                    {profileContext.name.split(" ")[0]}
                  </p>
                )}
                <ChatMessage role={msg.role as "user" | "assistant"} content={msg.content} />
              </div>
            ))}
            {simulateMutation.isPending && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-border bg-card px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {profileContext.name.split(" ")[0]} is typing...
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card">
        <div className="container mx-auto max-w-3xl px-4 py-4">
          <div className="mb-2 text-xs text-muted-foreground">
            💡 Tip: This is a simulation. Use it to practice icebreakers and discover synergies!
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type your message..."
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={simulateMutation.isPending}
            />
            <button
              onClick={handleSend}
              disabled={simulateMutation.isPending || !input.trim()}
              className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
