import { GeminiLiveVoice } from "@mastra/voice-google-gemini-live";
import { voiceOnboardingAgent } from "@/mastra/agents/voice-onboarding-agent";
import { PassThrough } from "stream";

export const dynamic = "force-dynamic";

// Global session storage for voice instances
const globalVoiceSessions = new Map<
  string,
  {
    voice: GeminiLiveVoice;
    sessionId: string;
    transcripts: Array<{ role: string; text: string }>;
    audioInputStream: PassThrough;
  }
>();

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
        console.log("🎤 Starting Mastra Voice session:", sessionId);

        const sendSSE = (data: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Controller closed
          }
        };

        // Create Mastra GeminiLiveVoice instance
        const voice = new GeminiLiveVoice({
          apiKey: process.env.GOOGLE_API_KEY!,
          model: "gemini-2.0-flash-live-001",
          speaker: "Puck",
          debug: true,
          instructions: `You are SEED, a friendly voice assistant helping people find connections.

IMPORTANT: Start by greeting the user and asking: "Hi! What's your name?"

Then ask these questions one at a time:
2. Where are you based?
3. What's your biggest priority right now?
4. Who are you looking for?
5. What do you do for fun?

Rules:
- Keep responses VERY short (under 10 words)
- Just acknowledge and ask the next question
- After question 5, say: "Perfect! Let me find your matches."`,
          sessionConfig: {
            interrupts: {
              enabled: true,
              allowUserInterruption: true,
            },
          },
        });

        const transcripts: Array<{ role: string; text: string }> = [];

        // Set up event listeners
        voice.on("speaker", (audioStream) => {
          console.log("🔊 Received audio stream from agent");
          // The audioStream is a NodeJS.ReadableStream
          // We need to buffer it and send as base64
          const chunks: Buffer[] = [];
          audioStream.on("data", (chunk: Buffer) => {
            chunks.push(chunk);
          });
          audioStream.on("end", () => {
            const audioBuffer = Buffer.concat(chunks);
            const base64Audio = audioBuffer.toString("base64");
            sendSSE({
              type: "audioChunk",
              data: base64Audio,
            });
          });
        });

        voice.on("writing", ({ text, role }) => {
          console.log(`📝 ${role}: ${text}`);
          transcripts.push({ role, text });
          sendSSE({
            type: "transcript",
            role,
            text,
          });

          // Check for completion phrase
          if (
            role === "assistant" &&
            (text.toLowerCase().includes("find your matches") ||
              text.toLowerCase().includes("let me find") ||
              text.toLowerCase().includes("find some great matches"))
          ) {
            console.log("✅ Onboarding detected as complete!");
            sendSSE({
              type: "complete",
              transcripts,
            });
          }
        });

        voice.on("turnComplete", ({ timestamp }) => {
          console.log("✅ Turn complete at:", timestamp);
          sendSSE({
            type: "turnComplete",
            timestamp,
          });
        });

        voice.on("error", ({ message, code, details }) => {
          console.error("❌ Voice error:", message, code);
          sendSSE({
            type: "error",
            message,
            code,
            details,
          });
        });

        voice.on("session", ({ state, config }) => {
          console.log("🔄 Session state:", state);
          sendSSE({
            type: "session",
            state,
          });

          if (state === "connected") {
            sendSSE({ type: "connected" });
          }
        });

        // Connect to Gemini Live with runtime context
        await voice.connect({
          initialMessage: "Hi! What's your name?",
        });

        // Create audio input stream for continuous microphone data
        const audioInputStream = new PassThrough();

        // Send signal that we're ready
        sendSSE({ type: "ready" });

        // Start sending microphone stream to voice (continuous streaming)
        // This enables bidirectional audio communication
        voice.send(audioInputStream as any).catch((err) => {
          console.error("Error sending audio stream:", err);
        });

        // Store session
        globalVoiceSessions.set(sessionId, {
          voice,
          sessionId,
          transcripts,
          audioInputStream,
        });

        // Keep alive
        const keepAlive = setInterval(() => {
          sendSSE({ type: "ping" });
        }, 20000);

        // Cleanup on abort
        req.signal.addEventListener("abort", () => {
          console.log("🔌 Client disconnected, cleaning up...");
          clearInterval(keepAlive);
          audioInputStream.end();
          voice.disconnect().catch(console.error);
          globalVoiceSessions.delete(sessionId);
        });
      } catch (error: any) {
        console.error("❌ Error starting Mastra voice session:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`
          )
        );
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

// Handle incoming audio from browser microphone
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return Response.json({ error: "Session ID required" }, { status: 400 });
    }

    const sessionData = globalVoiceSessions.get(sessionId);
    if (!sessionData) {
      return Response.json({ error: "No active voice session" }, { status: 404 });
    }

    // Get audio data from request
    const audioData = await req.arrayBuffer();
    const int16Array = new Int16Array(audioData);

    // Write audio chunk to the continuous stream
    // The send() call made during initialization will process this
    sessionData.audioInputStream.write(int16Array);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("❌ Error processing audio:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
