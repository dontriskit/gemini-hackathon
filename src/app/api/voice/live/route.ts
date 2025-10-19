import { GoogleGenAI, Modality, MediaResolution, type LiveServerMessage, type Session } from "@google/genai";

export const dynamic = "force-dynamic";

// Global session storage
const globalSessions = new Map<string, {
  session: Session;
  responseQueue: LiveServerMessage[];
  audioParts: string[];
}>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return new Response("Session ID required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log("🎤 Starting Gemini Live:", sessionId);

        const sendSSE = (data: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };

        const ai = new GoogleGenAI({
          apiKey: process.env.GOOGLE_API_KEY!,
        });

        const responseQueue: LiveServerMessage[] = [];
        const audioParts: string[] = [];

        // Helper: Wait for next message
        async function waitMessage(): Promise<LiveServerMessage> {
          while (true) {
            const message = responseQueue.shift();
            if (message) return message;
            await new Promise((r) => setTimeout(r, 100));
          }
        }

        // Helper: Handle complete turn
        async function handleTurn(): Promise<LiveServerMessage[]> {
          const turns: LiveServerMessage[] = [];
          let done = false;
          while (!done) {
            const message = await waitMessage();
            turns.push(message);
            if (message.serverContent?.turnComplete) {
              done = true;
            }
          }
          return turns;
        }

        // Connect to Gemini Live
        const session = await ai.live.connect({
          model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
          config: {
            responseModalities: [Modality.AUDIO],
            mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: "Puck",
                },
              },
            },
            systemInstruction: {
              parts: [
                {
                  text: `You are SEED. Ask these questions ONE AT A TIME:
1. What's your name?
2. Where are you based?
3. What's your biggest priority?
4. Who are you looking for?
5. What do you do for fun?

Keep answers SHORT. When done, say: "Perfect! Ready to find matches?"`,
                },
              ],
            },
          },
          callbacks: {
            onopen: () => {
              console.log("✅ Connected");
              sendSSE({ type: "connected" });
            },
            onmessage: (message: LiveServerMessage) => {
              responseQueue.push(message);
            },
            onerror: (e: ErrorEvent) => {
              console.error("❌ Error:", e.message);
              sendSSE({ type: "error", message: e.message });
            },
            onclose: (e: CloseEvent) => {
              console.log("🎤 Closed:", e.reason);
            },
          },
        });

        // Store session globally
        globalSessions.set(sessionId, { session, responseQueue, audioParts });

        // Start conversation
        session.sendClientContent({
          turns: ["What's your name?"],
          turnComplete: true,
        });

        // Process turns in background
        (async () => {
          try {
            while (true) {
              const turns = await handleTurn();

              // Process each message in the turn
              for (const turn of turns) {
                // Text content
                if (turn.serverContent?.modelTurn?.parts) {
                  for (const part of turn.serverContent.modelTurn.parts) {
                    if (part.text) {
                      console.log("📝 Agent:", part.text);
                      sendSSE({ type: "transcript", role: "assistant", text: part.text });
                    }
                  }
                }

                // Audio data (base64 PCM16)
                if (turn.data) {
                  console.log("🔊 Audio chunk:", turn.data.length, "bytes");
                  audioParts.push(turn.data);
                  sendSSE({ type: "audioChunk", data: turn.data });
                }
              }

              sendSSE({ type: "turnComplete" });
            }
          } catch (e) {
            console.log("Turn loop ended:", e);
          }
        })();

        sendSSE({ type: "ready" });

        // Keep alive
        const keepAlive = setInterval(() => {
          sendSSE({ type: "ping" });
        }, 20000);

        // Cleanup
        req.signal.addEventListener("abort", () => {
          clearInterval(keepAlive);
          globalSessions.delete(sessionId);
          session.close();
        });
      } catch (error: any) {
        console.error("Error:", error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Handle incoming audio from browser
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return Response.json({ error: "Session ID required" }, { status: 400 });
    }

    const sessionData = globalSessions.get(sessionId);
    if (!sessionData) {
      return Response.json({ error: "No active session" }, { status: 404 });
    }

    const audioData = await req.arrayBuffer();
    const base64Audio = Buffer.from(audioData).toString("base64");

    // Send user audio using sendRealtimeInput (per docs)
    sessionData.session.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: "audio/pcm;rate=16000",
      },
    });

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
