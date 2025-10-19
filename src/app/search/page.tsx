"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/trpc/react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "@/components/chat-message";

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
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const searchMutation = api.chat.search.useMutation({
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      setThreadId(data.threadId);
      setIsSearching(false);

      // Extract matches from tool results
      if (data.toolResults && Array.isArray(data.toolResults)) {
        for (const toolResult of data.toolResults) {
          if (toolResult.toolName === "search-people-tool" && toolResult.result?.matches) {
            setMatches(toolResult.result.matches);
            break;
          }
        }
      }
    },
    onError: () => {
      setIsSearching(false);
    },
  });

  useEffect(() => {
    const sid = localStorage.getItem("seedSessionId");
    if (!sid) {
      router.push("/onboard");
      return;
    }
    setSessionId(sid);

    // Show initial prompt
    setMessages([{
      role: "assistant",
      content: "Great! Now let me search for people who match what you're looking for.\n\nTell me what kind of connections you want to make, or say **'find matches'** and I'll search based on what we discussed in onboarding."
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || searchMutation.isPending) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setIsSearching(true);

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
            AI-powered search across {matches.length > 0 ? "424 " : ""}hackathon participants
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
                  <ChatMessage key={idx} role={msg.role as "user" | "assistant"} content={msg.content} />
                ))}
                {searchMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-border bg-card px-4 py-3">
                      <p className="text-sm text-muted-foreground">🔍 Searching through 424 profiles...</p>
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
                placeholder="Describe who you're looking for..."
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
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top Matches</h2>
            {matches.length > 0 && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {matches.length} {matches.length === 1 ? "match" : "matches"}
              </span>
            )}
          </div>

          {isSearching ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p>Searching for matches...</p>
            </div>
          ) : matches.length === 0 ? (
            <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-border text-center text-muted-foreground">
              <div>
                <p className="mb-2 text-lg">No matches yet</p>
                <p className="text-sm">Tell me who you're looking for to get started!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {matches.map((profile, idx) => (
                <div
                  key={profile.username}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-foreground">{profile.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{profile.headline}</p>
                    </div>
                    <div className="ml-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      #{idx + 1}
                    </div>
                  </div>

                  <div className="mb-3 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span>📍</span>
                    <span>{profile.location}</span>
                  </div>

                  <p className="mb-4 text-sm leading-relaxed text-foreground">{profile.summary}</p>

                  <div className="mb-4 rounded-md bg-muted/50 p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Why this match?
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">{profile.reasoning}</p>
                  </div>

                  <button
                    onClick={() => handleSimulate(profile)}
                    className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
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
