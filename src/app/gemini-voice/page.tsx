"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface ProfileMatch {
  username: string;
  name: string;
  headline: string;
  location: string;
  summary: string;
  score: number;
  reasoning: string;
  avatar?: string;
  email?: string;
}

export default function GeminiVoicePage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [userContext, setUserContext] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);
  const isConnectedRef = useRef(false); // Use ref to avoid closure issues

  useEffect(() => {
    // Get or create session ID
    let sid = localStorage.getItem("seedSessionId");
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("seedSessionId", sid);
    }
    setSessionId(sid);

    // Clear the "from Gemini Voice" flag when on this page
    localStorage.removeItem("fromGeminiVoice");
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const playNextChunk = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    const audioData = audioQueueRef.current.shift()!;

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      nextStartTimeRef.current = audioContextRef.current.currentTime;
    }

    const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length, 24000);
    const channelData = audioBuffer.getChannelData(0);

    // Convert Int16 to Float32
    for (let i = 0; i < audioData.length; i++) {
      channelData[i] = audioData[i] / 0x7fff;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);

    // Schedule audio to play at the next available time
    const startTime = Math.max(audioContextRef.current.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    // When this chunk ends, play the next one
    source.onended = () => {
      isPlayingRef.current = false;
      playNextChunk();
    };
  };

  const queueAudioChunk = (audioData: Int16Array) => {
    audioQueueRef.current.push(audioData);
    playNextChunk();
  };

  const startVoiceSession = async () => {
    try {
      // Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;

      // Connect to Gemini Live SSE endpoint
      const eventSource = new EventSource(`/api/voice/gemini-live?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          console.log("🎤 Gemini Live connected");
          isConnectedRef.current = true; // Set ref immediately
          setIsConnected(true);
        }

        if (data.type === "ready") {
          console.log("✅ Gemini Live ready");
          setIsListening(true);
        }

        if (data.type === "transcript") {
          console.log(`📝 ${data.role}: ${data.text}`);
          setTranscript((prev) => [...prev, { role: data.role, text: data.text }]);
        }

        if (data.type === "audio") {
          console.log("🔊 Received audio chunk from Gemini");
          try {
            const audioBytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
            const audioData = new Int16Array(audioBytes.buffer);
            queueAudioChunk(audioData);
          } catch (err) {
            console.error("Error playing audio:", err);
          }
        }

        if (data.type === "searchResults") {
          console.log("📊 Received search results:", data.matches);
          setMatches(data.matches || []);
        }

        if (data.type === "userContext") {
          console.log("💾 Received user context:", data.context);
          setUserContext(data.context);
          localStorage.setItem("userContext", JSON.stringify(data.context));
        }

        if (data.type === "error") {
          console.error("Voice error:", data.message);
          alert(`Voice error: ${data.message}`);
        }
      };

      eventSource.onerror = () => {
        console.error("SSE connection error");
        setIsConnected(false);
      };

      // Capture and stream microphone audio
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let chunkCount = 0;
      processor.onaudioprocess = async (e) => {
        // Use ref instead of state to avoid stale closure
        if (!isConnectedRef.current) {
          return; // Silently wait for connection
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);

        // Convert Float32 to Int16
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }

        chunkCount++;
        if (chunkCount % 100 === 0) {
          console.log(`🎤 Microphone active - sent ${chunkCount} audio chunks (total: ${chunkCount})`);
        }

        // Send audio chunk to Gemini Live
        try {
          await fetch(`/api/voice/gemini-live?sessionId=${sessionId}`, {
            method: "POST",
            body: pcm16.buffer,
            headers: {
              "Content-Type": "application/octet-stream",
            },
          });
        } catch (error) {
          console.error("Error sending audio:", error);
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (error) {
      console.error("Error starting voice:", error);
      alert("Could not access microphone. Please allow microphone access and try again.");
    }
  };

  const stopVoiceSession = () => {
    eventSourceRef.current?.close();

    // Stop all audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Clear audio queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    nextStartTimeRef.current = 0;
    isConnectedRef.current = false; // Reset ref too

    setIsConnected(false);
    setIsListening(false);
  };

  const handleSimulate = (profile: ProfileMatch) => {
    console.log("🎭 Starting simulation with:", profile.name);

    // Stop the Gemini Live voice session before transitioning
    stopVoiceSession();

    // Save profile for simulation
    localStorage.setItem("simulateProfile", JSON.stringify(profile));

    // Mark that we came from Gemini Voice (for back button)
    localStorage.setItem("fromGeminiVoice", "true");

    // Navigate to Mastra-powered simulation (uses maps tool)
    router.push(`/simulate/${profile.username}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground md:text-2xl">
              🎙️ Gemini Voice Search
            </h1>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Powered by Google Gemini Live
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground md:text-sm">
            Natural voice conversation to find your perfect connections
          </p>
          {userContext && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-primary hover:underline">
                📋 Show your search criteria
              </summary>
              <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                {userContext.name && <div><strong>Name:</strong> {userContext.name}</div>}
                {userContext.location && <div><strong>Location:</strong> {userContext.location}</div>}
                {userContext.priority && <div><strong>Priority:</strong> {userContext.priority}</div>}
                {userContext.lookingFor && <div><strong>Looking for:</strong> {userContext.lookingFor}</div>}
                {userContext.funActivities && <div><strong>Interests:</strong> {userContext.funActivities}</div>}
              </div>
            </details>
          )}
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        {/* Left: Voice Transcript */}
        <div className="flex w-full flex-col border-b border-border md:w-1/2 md:border-b-0 md:border-r">
          <div className="flex-1 overflow-y-auto p-4">
            {transcript.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                <div>
                  <p className="mb-2 text-lg">Ready to start your voice search</p>
                  <p className="text-sm">Press the microphone button below to begin</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {transcript.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Voice Control */}
          <div className="border-t border-border bg-card p-4">
            <div className="flex flex-col items-center gap-4">
              {!isConnected ? (
                <button
                  onClick={startVoiceSession}
                  className="group flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-4xl text-primary-foreground shadow-2xl transition-all hover:scale-110"
                >
                  <span className="transition-transform group-hover:scale-110">🎙️</span>
                </button>
              ) : (
                <button
                  onClick={stopVoiceSession}
                  className={`flex h-20 w-20 items-center justify-center rounded-full text-4xl shadow-2xl transition-all ${
                    isListening
                      ? "animate-pulse bg-red-500 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isListening ? "🔴" : "⏸️"}
                </button>
              )}
              <p className="text-sm font-medium">
                {!isConnected
                  ? "Tap to start voice conversation"
                  : isListening
                  ? "🎙️ Listening..."
                  : "Paused"}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Profile Cards */}
        <div className="w-full overflow-y-auto bg-muted/20 p-4 md:w-1/2 md:p-6">
          <div className="mb-3 flex items-center justify-between md:mb-4">
            <h2 className="text-lg font-semibold">Top Matches</h2>
            {matches.length > 0 && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                {matches.length} {matches.length === 1 ? "match" : "matches"}
              </span>
            )}
          </div>

          {matches.length > 0 ? (
            <div className="space-y-4">
              {matches.map((profile, idx) => (
                <div
                  key={profile.username}
                  className="rounded-lg border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="mb-4 flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {profile.avatar ? (
                        <img
                          src={profile.avatar}
                          alt={profile.name}
                          className="h-14 w-14 rounded-full border-2 border-border object-cover"
                          onError={(e) => {
                            e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=623dbe&color=fff&size=128`;
                          }}
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                          {profile.name.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Name & Headline */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-foreground">{profile.name}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{profile.headline}</p>
                    </div>

                    {/* Match Number Badge */}
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
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
                    💬 Start Text Simulation
                  </button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Voice will stop • Powered by Mastra AI + Maps
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-border text-center text-muted-foreground">
              <div>
                <p className="mb-2 text-lg">No matches yet</p>
                <p className="text-sm">Start the voice conversation to find matches!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
