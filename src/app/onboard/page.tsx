"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "@/components/chat-message";

export default function OnboardPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const onboardMutation = api.chat.onboard.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      setThreadId(data.threadId);

      // Check if onboarding is complete
      if (data.message.toLowerCase().includes("ready to see") ||
          data.message.toLowerCase().includes("ready to find")) {
        setIsComplete(true);
      }
    },
  });

  useEffect(() => {
    // Get or create session ID
    let sid = localStorage.getItem("seedSessionId");
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("seedSessionId", sid);
    }
    setSessionId(sid);

    // Show welcome message (no API call yet - user starts conversation)
    setMessages([{
      role: "assistant",
      content: "Hi! I'm SEED, and I'm here to help you find great connections at the hackathon. Let's start by getting to know you better.\n\nWhat's your name?"
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || onboardMutation.isPending) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");

    onboardMutation.mutate({
      message: userMessage,
      sessionId,
      threadId: threadId || undefined,
    });
  };

  const handleContinue = () => {
    router.push("/search");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">🌱 SEED Onboarding</h1>
          <p className="text-sm text-muted-foreground">Tell us about yourself so we can find great connections</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-3xl px-4 py-8">
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <ChatMessage key={idx} role={msg.role as "user" | "assistant"} content={msg.content} />
            ))}
            {onboardMutation.isPending && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-border bg-card px-4 py-3">
                  <p className="text-sm text-muted-foreground">Thinking...</p>
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
          {isComplete ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Onboarding complete!</p>
              <button
                onClick={handleContinue}
                className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Continue to Search →
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Type your response..."
                className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={onboardMutation.isPending}
              />
              <button
                onClick={handleSend}
                disabled={onboardMutation.isPending || !input.trim()}
                className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
