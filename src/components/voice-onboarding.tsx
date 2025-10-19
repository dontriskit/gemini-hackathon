"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function VoiceOnboarding({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [isComplete, setIsComplete] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const startVoiceSession = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Connect to voice WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/voice/live?sessionId=${sessionId}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("🎤 Voice connection established");
        setIsConnected(true);
        setIsListening(true);

        // Start streaming microphone audio
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
          }

          // Send audio to server
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(pcm16.buffer);
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "transcript") {
          setTranscript((prev) => [...prev, { role: data.role, text: data.text }]);

          // Check if onboarding complete
          if (data.text.toLowerCase().includes("got it! i have everything")) {
            setIsComplete(true);
            setTimeout(() => router.push("/search"), 2000);
          }
        }

        if (data.type === "audio") {
          // Play agent's audio response
          const audioBlob = new Blob([Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))], {
            type: "audio/pcm",
          });
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          audio.play();
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("Voice connection closed");
        setIsConnected(false);
        setIsListening(false);
      };
    } catch (error) {
      console.error("Error starting voice:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopVoiceSession = () => {
    wsRef.current?.close();
    audioContextRef.current?.close();
    setIsListening(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/20 to-background p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">🌱 SEED Voice Onboarding</h1>
          <p className="mt-2 text-muted-foreground">
            Have a natural conversation to find your perfect connections
          </p>
        </div>

        {/* Transcript */}
        <div className="mb-8 min-h-[300px] rounded-lg border border-border bg-card p-6">
          <div className="space-y-3">
            {transcript.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
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
        </div>

        {/* Voice Control */}
        <div className="flex flex-col items-center gap-6">
          {!isConnected ? (
            <button
              onClick={startVoiceSession}
              className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-4xl text-primary-foreground shadow-lg transition-transform hover:scale-110 hover:shadow-xl"
            >
              🎤
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={stopVoiceSession}
                className={`flex h-24 w-24 items-center justify-center rounded-full text-4xl shadow-lg transition-all ${
                  isListening
                    ? "animate-pulse bg-red-500 text-white"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {isListening ? "🔴" : "⏸️"}
              </button>
              {isListening && (
                <div className="absolute -inset-2 animate-ping rounded-full bg-primary/20"></div>
              )}
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {!isConnected && "Tap to start voice conversation"}
            {isConnected && isListening && "Listening... Speak naturally"}
            {isConnected && !isListening && "Paused"}
          </p>

          {isComplete && (
            <div className="rounded-lg bg-green-500/10 px-6 py-3 text-center">
              <p className="font-semibold text-green-600">
                ✅ Onboarding complete! Redirecting to search...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
