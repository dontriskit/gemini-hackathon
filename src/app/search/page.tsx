"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";

interface ProfileMatch {
  username: string;
  name: string;
  headline: string;
  location: string;
  summary: string;
  score: number;
  reasoning: string;
}

export default function SearchPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [threadId, setThreadId] = useState("");
  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const searchMutation = api.chat.search.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      setThreadId(data.threadId);

      // Extract matches from tool results
      if (data.toolResults && data.toolResults.length > 0) {
        const searchResults = data.toolResults.find((r: any) => r.toolName === "search-people-tool");
        if (searchResults?.result?.matches) {
          setMatches(searchResults.result.matches);
        }
      }
    },
  });

  useEffect(() => {
    const sid = localStorage.getItem("seedSessionId");
    if (!sid) {
      router.push("/onboard");
      return;
    }
    setSessionId(sid);

    // Initial search based on onboarding context
    searchMutation.mutate({
      message: "I'm ready to find connections! Show me people who match what I'm looking for.",
      sessionId: sid,
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || searchMutation.isPending) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");

    searchMutation.mutate({
      message: userMessage,
      sessionId,
      threadId: threadId || undefined,
    });
  };

  const handleSimulate = (profile: ProfileMatch) => {
    // Store profile context for simulator
    localStorage.setItem("simulateProfile", JSON.stringify(profile));
    router.push(`/simulate/${profile.username}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">🔍 Find Your Matches</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered search across hackathon participants
          </p>
        </div>
      </div>

      {/* Main Content - Split Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex w-1/2 flex-col border-r border-border">
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border border-border text-card-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {searchMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-sm text-muted-foreground">Searching...</p>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-border bg-card p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Refine your search..."
                className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={searchMutation.isPending}
              />
              <button
                onClick={handleSend}
                disabled={searchMutation.isPending || !input.trim()}
                className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Right: Profile Cards */}
        <div className="w-1/2 overflow-y-auto bg-muted/20 p-6">
          <h2 className="mb-4 text-lg font-semibold">Top Matches</h2>
          {matches.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <p>Searching for matches...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((profile, idx) => (
                <div
                  key={profile.username}
                  className="rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{profile.name}</h3>
                      <p className="text-sm text-muted-foreground">{profile.headline}</p>
                    </div>
                    <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      #{idx + 1}
                    </div>
                  </div>

                  <div className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
                    <span>📍</span>
                    <span>{profile.location}</span>
                  </div>

                  <p className="mb-3 text-sm">{profile.summary}</p>

                  <div className="mb-4 rounded-md bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground">Why this match?</p>
                    <p className="mt-1 text-sm">{profile.reasoning}</p>
                  </div>

                  <button
                    onClick={() => handleSimulate(profile)}
                    className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    💬 Simulate Conversation
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
