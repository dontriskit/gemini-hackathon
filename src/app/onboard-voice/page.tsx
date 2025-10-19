"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function VoiceOnboardPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [isComplete, setIsComplete] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const audioQueueRef = useRef<Int16Array[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    // Get or create session ID
    let sid = localStorage.getItem("seedSessionId");
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("seedSessionId", sid);
    }
    setSessionId(sid);
  }, []);

  const playAudioChunk = async (audioData: Int16Array, sampleRate: number) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate });
    }

    const audioBuffer = audioContextRef.current.createBuffer(1, audioData.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    // Convert Int16 to Float32
    for (let i = 0; i < audioData.length; i++) {
      channelData[i] = audioData[i] / 0x7fff;
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    source.start();
  };

  const startVoiceSession = async () => {
    try {
      // Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Connect to Gemini Live SSE endpoint (following Google docs pattern)
      const eventSource = new EventSource(`/api/voice/live?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "connected" || data.type === "ready") {
          console.log("🎤 Voice session connected and ready");
          setIsConnected(true);
          setIsListening(true);
        }

        if (data.type === "transcript") {
          console.log(`📝 ${data.role}: ${data.text}`);
          setTranscript((prev) => [...prev, { role: data.role, text: data.text }]);

          // Check for completion
          if (data.text.toLowerCase().includes("got it! i have everything") ||
              data.text.toLowerCase().includes("ready to see")) {
            setIsComplete(true);

            // Extract and save context
            const context: any = {};
            transcript.forEach((msg) => {
              if (msg.role === "user") {
                const text = msg.text.toLowerCase();
                if (!context.name && text.length < 50) context.name = msg.text;
                if (text.includes("live") || text.includes("based")) context.location = msg.text;
                if (text.includes("priority")) context.priority = msg.text;
                if (text.includes("looking for")) context.lookingFor = msg.text;
                if (text.includes("fun")) context.funActivities = msg.text;
              }
            });

            localStorage.setItem("userContext", JSON.stringify(context));

            // Auto-redirect to search
            setTimeout(() => router.push("/search"), 2000);
          }
        }

        if (data.type === "audioChunk") {
          console.log("🔊 Received audio chunk, playing...");
          // Decode base64 audio from turn.data (per Google docs)
          try {
            const audioBytes = Uint8Array.from(atob(data.data), (c) => c.charCodeAt(0));
            const audioData = new Int16Array(audioBytes.buffer);

            // Play audio chunk immediately
            await playAudioChunk(audioData, 24000); // Gemini outputs 24kHz
          } catch (err) {
            console.error("Error playing audio:", err);
          }
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

      processor.onaudioprocess = async (e) => {
        if (!isConnected) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);

        // Convert Float32 to Int16
        for (let i = 0; i < inputData.length; i++) {
          pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }

        // Send audio chunk to server
        try {
          await fetch(`/api/voice/live?sessionId=${sessionId}`, {
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
    audioContextRef.current?.close();
    setIsConnected(false);
    setIsListening(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">🌱 SEED Voice Onboarding</h1>
          <p className="text-sm text-muted-foreground">
            Have a natural voice conversation to find great connections
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
                <p>Start voice conversation to begin...</p>
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
                      <p className="text-sm">{msg.text}</p>
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
                  className="flex h-28 w-28 items-center justify-center rounded-full bg-primary text-5xl text-primary-foreground shadow-xl transition-transform hover:scale-110 hover:shadow-2xl"
                >
                  🎤
                </button>
                <p className="mt-4 text-sm font-medium text-muted-foreground">
                  Tap to start voice conversation
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Powered by Google Gemini Live
                </p>
              </div>
            ) : (
              <div className="text-center">
                <div className="relative inline-block">
                  <button
                    onClick={stopVoiceSession}
                    className={`flex h-28 w-28 items-center justify-center rounded-full text-5xl shadow-xl transition-all ${
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
                <button
                  onClick={stopVoiceSession}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  Stop voice conversation
                </button>
              </div>
            )}

            {isComplete && (
              <div className="rounded-lg border border-green-500 bg-green-500/10 px-8 py-4 text-center">
                <p className="text-lg font-semibold text-green-600">
                  ✅ Onboarding complete!
                </p>
                <p className="mt-1 text-sm text-green-600/80">Redirecting to search...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
