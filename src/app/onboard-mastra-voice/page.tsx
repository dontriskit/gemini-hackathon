"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function MastraVoiceOnboardPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [isComplete, setIsComplete] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);
  const nextStartTimeRef = useRef(0);

  useEffect(() => {
    // Get or create session ID
    let sid = localStorage.getItem("seedSessionId");
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("seedSessionId", sid);
    }
    setSessionId(sid);
  }, []);

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

  const extractUserContext = () => {
    const context: any = {};

    // Parse transcript to extract answers
    for (let i = 0; i < transcript.length; i++) {
      const msg = transcript[i];

      if (msg.role === "user") {
        const prevAssistant = i > 0 ? transcript[i - 1] : null;

        if (prevAssistant && prevAssistant.role === "assistant") {
          const question = prevAssistant.text.toLowerCase();

          // Name
          if (question.includes("what's your name") || question.includes("i'm seed")) {
            context.name = msg.text;
          }
          // Location
          else if (question.includes("where") && question.includes("based")) {
            context.location = msg.text;
          }
          // Priority
          else if (question.includes("priority") || question.includes("biggest")) {
            context.priority = msg.text;
          }
          // Looking for
          else if (question.includes("connect with") || question.includes("looking for")) {
            context.lookingFor = msg.text;
          }
          // Fun activities
          else if (question.includes("fun") || question.includes("do for")) {
            context.funActivities = msg.text;
          }
        }
      }
    }

    return context;
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

      // Connect to Mastra Voice SSE endpoint
      const eventSource = new EventSource(`/api/voice/mastra-live?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "connected") {
          console.log("🎤 Mastra Voice connected");
          setIsConnected(true);
        }

        if (data.type === "ready") {
          console.log("✅ Mastra Voice ready");
          setIsListening(true);
        }

        if (data.type === "transcript") {
          console.log(`📝 ${data.role}: ${data.text}`);
          setTranscript((prev) => [...prev, { role: data.role, text: data.text }]);
        }

        if (data.type === "audioChunk") {
          console.log("🔊 Received audio chunk from Mastra Voice");
          try {
            const audioBytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
            const audioData = new Int16Array(audioBytes.buffer);
            queueAudioChunk(audioData); // Queue for sequential playback
          } catch (err) {
            console.error("Error playing audio:", err);
          }
        }

        if (data.type === "complete") {
          console.log("✅ Onboarding complete!");
          setIsComplete(true);

          // Extract and save user context
          const context = extractUserContext();
          console.log("💾 Saving user context:", context);
          localStorage.setItem("userContext", JSON.stringify(context));

          // Auto-redirect to search
          setTimeout(() => router.push("/search"), 2500);
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

      processor.onaudioprocess = async (e) => {
        if (!isConnected) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);

        // Convert Float32 to Int16
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }

        // Send audio chunk to Mastra Voice
        try {
          await fetch(`/api/voice/mastra-live?sessionId=${sessionId}`, {
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

    setIsConnected(false);
    setIsListening(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">
              🎙️ SEED Mastra Voice
            </h1>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Powered by Mastra AI
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Natural voice conversation with AI to find your perfect connections
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Transcript */}
          <div className="mb-8 min-h-[300px] max-h-[400px] overflow-y-auto rounded-lg border border-border bg-card p-6">
            {transcript.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="mb-2 text-lg">Ready to start your voice onboarding</p>
                  <p className="text-sm">
                    Press the microphone button below to begin
                  </p>
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
              </div>
            )}
          </div>

          {/* Voice Control */}
          <div className="flex flex-col items-center gap-6">
            {!isConnected ? (
              <div className="text-center">
                <button
                  onClick={startVoiceSession}
                  className="group flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-5xl text-primary-foreground shadow-2xl transition-all hover:scale-110 hover:shadow-3xl"
                >
                  <span className="transition-transform group-hover:scale-110">🎙️</span>
                </button>
                <p className="mt-4 text-sm font-medium text-foreground">
                  Tap to start Mastra Voice conversation
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Powered by Mastra AI • Google Gemini Live
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="relative inline-block">
                  <button
                    onClick={stopVoiceSession}
                    className={`flex h-28 w-28 items-center justify-center rounded-full text-5xl shadow-2xl transition-all ${
                      isListening
                        ? "animate-pulse bg-red-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isListening ? "🔴" : "⏸️"}
                  </button>
                  {isListening && (
                    <>
                      <div className="absolute -inset-4 animate-ping rounded-full bg-red-500/30"></div>
                      <div className="absolute -inset-2 animate-ping rounded-full bg-red-500/50 animation-delay-150"></div>
                    </>
                  )}
                </div>
                <p className="mt-4 text-sm font-medium">
                  {isListening ? "🎙️ Listening... speak naturally" : "Paused"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isListening ? "I can hear you!" : "Click to resume"}
                </p>
                <button
                  onClick={stopVoiceSession}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  Stop voice conversation
                </button>
              </div>
            )}

            {isComplete && (
              <div className="animate-fade-in rounded-lg border-2 border-green-500 bg-green-500/10 px-8 py-4 text-center">
                <p className="text-lg font-semibold text-green-600">
                  ✅ Onboarding complete!
                </p>
                <p className="mt-1 text-sm text-green-600/80">
                  Finding your perfect matches...
                </p>
              </div>
            )}
          </div>

          {/* Progress Indicator */}
          {transcript.length > 0 && !isComplete && (
            <div className="mt-6 text-center">
              <div className="mx-auto flex max-w-md items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((step) => {
                  const userMessages = transcript.filter((t) => t.role === "user").length;
                  return (
                    <div
                      key={step}
                      className={`h-2 flex-1 rounded-full transition-all ${
                        userMessages >= step
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Question {Math.min(transcript.filter((t) => t.role === "user").length + 1, 5)} of 5
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
