import { GoogleGenAI, type LiveServerMessage } from "@google/genai";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");

  if (!sessionId) {
    return new Response("Session ID required", { status: 400 });
  }

  const encoder = new TextEncoder();
  const responseQueue: LiveServerMessage[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      try {
        console.log("🎤 Starting direct Gemini Live session for:", sessionId);

        const ai = new GoogleGenAI({
          apiKey: process.env.GOOGLE_API_KEY!,
        });

        const sendSSE = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Connect to Gemini Live
        const session = await ai.live.connect({
          model: "models/gemini-2.5-flash-native-audio-preview-09-2025",
          config: {
            responseModalities: ["AUDIO"],
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
                  text: `You are SEED, a friendly relationship-building assistant.
Your job is to help users plant long-term relationships by understanding who they are and who they're looking for.

Ask these questions ONE AT A TIME:
1. What's your name?
2. Where are you based?
3. What is the biggest priority in your life right now, and who could help you with that?
4. In one sentence, describe who you're looking for.
5. What do you like to do for fun?

Keep responses SHORT and conversational (2-3 sentences max).
When you've gathered all info, say: "Got it! I have everything I need. Ready to see some recommendations?"`,
                },
              ],
            },
          },
          callbacks: {
            onopen: () => {
              console.log("🎤 Gemini Live connection opened");
              sendSSE({ type: "connected" });
            },
            onmessage: (message: LiveServerMessage) => {
              responseQueue.push(message);
              handleMessage(message, sendSSE);
            },
            onerror: (e: ErrorEvent) => {
              console.error("🎤 Gemini Live error:", e.message);
              sendSSE({ type: "error", message: e.message });
            },
            onclose: (e: CloseEvent) => {
              console.log("🎤 Gemini Live closed:", e.reason);
              sendSSE({ type: "closed", reason: e.reason });
              controller.close();
            },
          },
        });

        // Start conversation
        session.sendClientContent({
          turns: [
            "Hi! I'm SEED, and I'm here to help you find great connections at the hackathon. Let's start by getting to know you better. What's your name?",
          ],
        });

        sendSSE({ type: "ready" });

        // Store session for POST requests
        global.geminiSessions = global.geminiSessions || new Map();
        global.geminiSessions.set(sessionId, session);

        // Keep alive
        const keepAlive = setInterval(() => {
          sendSSE({ type: "ping" });
        }, 30000);

        req.signal.addEventListener("abort", () => {
          clearInterval(keepAlive);
          session.close();
          global.geminiSessions?.delete(sessionId);
          controller.close();
        });
      } catch (error: any) {
        console.error("Error starting voice session:", error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message: error.message })}\n\n`)
        );
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

function handleMessage(message: LiveServerMessage, sendSSE: (data: any) => void) {
  // Handle server content (text + audio)
  if (message.serverContent?.modelTurn) {
    const parts = message.serverContent.modelTurn.parts || [];

    for (const part of parts) {
      // Text content
      if (part.text) {
        console.log("📝 Agent:", part.text);
        sendSSE({ type: "transcript", role: "assistant", text: part.text });
      }

      // Audio content
      if (part.inlineData) {
        console.log("🔊 Agent audio received");
        sendSSE({
          type: "audio",
          audio: part.inlineData.data, // base64 encoded PCM16
          mimeType: part.inlineData.mimeType,
        });
      }
    }

    // Turn complete
    if (message.serverContent.turnComplete) {
      console.log("✅ Turn complete");
      sendSSE({ type: "turnComplete" });
    }
  }

  // Handle tool calls (if needed)
  if (message.toolCall) {
    console.log("🔧 Tool called:", message.toolCall.functionCalls);
    sendSSE({ type: "toolCall", calls: message.toolCall.functionCalls });
  }
}

// Handle incoming audio from client
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return Response.json({ error: "Session ID required" }, { status: 400 });
    }

    const session = global.geminiSessions?.get(sessionId);
    if (!session) {
      return Response.json({ error: "No active session" }, { status: 404 });
    }

    // Get audio data from request body
    const audioData = await req.arrayBuffer();
    const int16Array = new Int16Array(audioData);

    console.log(`🎤 Received audio: ${int16Array.length} samples`);

    // Send to Gemini Live
    session.send({
      realtimeInput: {
        mediaChunks: [
          {
            data: Buffer.from(audioData).toString("base64"),
            mimeType: "audio/pcm;rate=16000",
          },
        ],
      },
    });

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Error processing audio:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Type augmentation for global
declare global {
  var geminiSessions: Map<string, any> | undefined;
}
