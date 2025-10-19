import { mastra } from "@/mastra";
import { GeminiLiveVoice } from "@mastra/voice-google-gemini-live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return new Response("Session ID required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const agent = mastra.getAgent("onboardingAgent");

  // Initialize voice at runtime (env vars are available now!)
  if (!agent.voice) {
    console.log("🎤 Initializing Gemini Live voice with API key...");
    agent.voice = new GeminiLiveVoice({
      apiKey: process.env.GOOGLE_API_KEY!,
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      speaker: "Puck",
      debug: true,
      sessionConfig: {
        generationConfig: {
          responseModalities: ["AUDIO", "TEXT"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Puck",
              },
            },
          },
        },
      },
    });
  }

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log("🎤 Starting Gemini Live voice session for:", sessionId);
        console.log("🔑 API Key present:", !!process.env.GOOGLE_API_KEY);

        // Connect to Gemini Live
        await agent.voice!.connect();

        // Send initial message
        const sendSSE = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Listen for transcripts
        agent.voice!.on("writing", ({ text, role }) => {
          console.log(`📝 ${role}: ${text}`);
          sendSSE({ type: "transcript", role, text });
        });

        // Listen for audio from agent
        agent.voice!.on("speaking", ({ audioData }) => {
          if (audioData) {
            console.log("🔊 Agent speaking, audio data:", audioData.length, "samples");
            // Convert Int16Array to base64
            const base64 = Buffer.from(audioData.buffer).toString("base64");
            sendSSE({ type: "audio", audio: base64, sampleRate: 24000 });
          }
        });

        // Listen for turn completion
        agent.voice!.on("turnComplete", ({ timestamp }) => {
          console.log("✅ Turn complete at:", timestamp);
          sendSSE({ type: "turnComplete", timestamp });
        });

        // Listen for errors
        agent.voice!.on("error", (error) => {
          console.error("🎤 Voice error:", error);
          sendSSE({ type: "error", message: error.message });
        });

        // Start conversation
        await agent.voice!.speak(
          "Hi! I'm SEED, and I'm here to help you find great connections at the hackathon. Let's start by getting to know you better. What's your name?"
        );

        sendSSE({ type: "ready" });

        // Keep connection alive
        const keepAlive = setInterval(() => {
          sendSSE({ type: "ping" });
        }, 30000);

        // Cleanup on close
        req.signal.addEventListener("abort", () => {
          console.log("🎤 Client disconnected");
          clearInterval(keepAlive);
          agent.voice!.close();
          controller.close();
        });
      } catch (error: any) {
        console.error("Error in voice session:", error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`));
        controller.close();
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

    const body = await req.arrayBuffer();
    const audioData = new Int16Array(body);

    console.log(`🎤 Received audio chunk: ${audioData.length} samples`);

    const agent = mastra.getAgent("onboardingAgent");

    // Send audio to Gemini Live
    await agent.voice!.send(audioData);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Error processing audio:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
