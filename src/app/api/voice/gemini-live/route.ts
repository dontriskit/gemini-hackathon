import { GoogleGenAI, Modality, MediaResolution, type LiveServerMessage, type Session } from "@google/genai";
import { VectaraClient } from "vectara";

export const dynamic = "force-dynamic";

// Session storage
const sessions = new Map<string, {
  session: Session;
  audioParts: string[];
  responseQueue: LiveServerMessage[];
  userContext: Record<string, string>;
  searchResults: any[];
  questionCount: number;
}>();

// Define the search function declaration for Gemini
const searchPeopleFunction = {
  name: "search_people",
  description: "Search for hackathon participants whose profiles match the given criteria. Returns top matching profiles with relevance scores.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Natural language search query describing who the user is looking for (e.g., 'ML researchers in SF', 'founders looking for technical cofounders')"
      },
      location: {
        type: "string",
        description: "Filter by location if specified"
      },
      limit: {
        type: "number",
        description: "Number of results to return (default: 3)",
        default: 3
      }
    },
    required: ["query"]
  }
};

// Execute the search function
async function executeSearchPeople(args: any) {
  try {
    const { query, location, limit = 3 } = args;

    const client = new VectaraClient({
      apiKey: process.env.VECTARA_API_KEY!,
    });

    let searchQuery = query;
    if (location) {
      searchQuery = `${query} location:${location}`;
    }

    const response = await client.query({
      query: searchQuery,
      search: {
        corpora: [
          {
            corpusKey: process.env.VECTARA_CORPUS_KEY || "seed-hackathon-profiles",
            lexicalInterpolation: 0.05,
          },
        ],
        contextConfiguration: {
          sentencesBefore: 2,
          sentencesAfter: 2,
        },
        limit: limit || 3,
      },
      generation: {
        generationPresetName: "vectara-summary-ext-v1.2.0",
        responseLanguage: "eng",
        enableFactualConsistencyScore: true,
      },
    });

    console.log("✅ Vectara search completed");

    const searchResults = response.searchResults || [];

    const matches = searchResults.slice(0, limit || 3).map((result: any) => {
      const metadata = result.partMetadata || {};
      const docId = result.documentId || "";

      return {
        username: metadata.username || docId || "unknown",
        name: metadata.name || "Unknown",
        headline: metadata.headline || "No headline available",
        location: metadata.location || "Location not specified",
        summary: metadata.summary || "No summary available",
        score: result.score || 0,
        reasoning: result.text?.slice(0, 300) || "Relevant profile based on search criteria",
        avatar: metadata.avatar || "",
        email: metadata.email || "",
      };
    });

    console.log(`Found ${matches.length} matches`);

    return {
      success: true,
      matches,
    };
  } catch (error) {
    console.error("Error searching profiles:", error);
    return {
      success: false,
      matches: [],
      error: `Failed to search profiles: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

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
        console.log("🎤 Starting Gemini Live session:", sessionId);

        const sendSSE = (data: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            // Controller may be closed
          }
        };

        const ai = new GoogleGenAI({
          apiKey: process.env.GOOGLE_API_KEY!,
        });

        const responseQueue: LiveServerMessage[] = [];
        const audioParts: string[] = [];
        const userContext: Record<string, string> = {};
        let searchResults: any[] = [];
        let questionCount = 0;

        // Connect to Gemini Live with function calling support
        const session = await ai.live.connect({
          model: "gemini-2.0-flash-live-001", // Half-cascade model with tool support
          config: {
            responseModalities: [Modality.AUDIO],
            tools: [
              {
                functionDeclarations: [searchPeopleFunction]
              }
            ],
            systemInstruction: {
              parts: [
                {
                  text: `You are SEED, a friendly voice assistant helping people find connections at a hackathon.

Your job is to conduct a natural voice conversation to understand who they're looking for, then search the participant database.

## Onboarding Questions (ask ONE at a time, WAIT for user response after each):
1. "Hi! What's your name?"
2. "Where are you based?"
3. "What's your biggest priority right now, and who could help you with that?"
4. "In one sentence, describe who you're looking for."
5. "What do you like to do for fun?"

## Rules:
- Keep responses SHORT (under 15 words per turn)
- Be warm and conversational
- WAIT for the user to respond after each question
- After collecting all 5 answers, say: "Perfect! Let me search for your matches." and IMMEDIATELY call the search_people function
- Build the search query from their answers (combine priority, looking for, and interests)
- After presenting results, ask if they want to refine the search

## Building Search Queries:
- Use their "looking for" answer as the main query
- Add their priority and interests as context
- Include location if they mentioned a preference

## After Search:
- Briefly introduce the matches (just say how many found)
- Ask if they want to see different matches or refine criteria
- Continue the conversation - don't end after showing results`,
                },
              ],
            },
          },
          callbacks: {
            onopen: () => {
              console.log("✅ Gemini Live connected");
              sendSSE({ type: "connected" });
            },
            onmessage: async (message: LiveServerMessage) => {
              responseQueue.push(message);

              // Process message immediately for SSE
              if (message.serverContent?.modelTurn?.parts) {
                for (const part of message.serverContent.modelTurn.parts) {
                  if (part.text) {
                    console.log("📝 Agent:", part.text);
                    sendSSE({ type: "transcript", role: "assistant", text: part.text });

                    // Count questions asked
                    if (part.text.includes("?")) {
                      questionCount++;
                    }
                  }

                  if (part.inlineData) {
                    console.log("🔊 Agent audio chunk received");
                    audioParts.push(part.inlineData.data);

                    // Send audio chunk immediately
                    sendSSE({
                      type: "audio",
                      data: part.inlineData.data,
                      mimeType: part.inlineData.mimeType,
                    });
                  }
                }
              }

              // Handle user input to extract context
              if (message.serverContent?.userTurn?.parts) {
                for (const part of message.serverContent.userTurn.parts) {
                  if (part.text) {
                    console.log("👤 User:", part.text);
                    sendSSE({ type: "transcript", role: "user", text: part.text });

                    // Extract context based on question count
                    if (questionCount === 1) userContext.name = part.text;
                    if (questionCount === 2) userContext.location = part.text;
                    if (questionCount === 3) userContext.priority = part.text;
                    if (questionCount === 4) userContext.lookingFor = part.text;
                    if (questionCount === 5) userContext.funActivities = part.text;

                    console.log("💾 User context:", userContext);
                  }
                }
              }

              // Handle tool calls (search function)
              if (message.toolCall?.functionCalls) {
                console.log("🔧 Tool call received:", message.toolCall.functionCalls);

                for (const fc of message.toolCall.functionCalls) {
                  if (fc.name === "search_people") {
                    console.log("🔍 Executing search with args:", fc.args);

                    const results = await executeSearchPeople(fc.args);
                    searchResults = results.matches || [];

                    console.log("📊 Search results:", results);

                    // Send results to frontend
                    sendSSE({
                      type: "searchResults",
                      matches: searchResults,
                    });

                    // Send user context to frontend
                    sendSSE({
                      type: "userContext",
                      context: userContext,
                    });

                    // Send tool response back to Gemini
                    session.sendToolResponse({
                      functionResponses: [{
                        id: fc.id,
                        name: fc.name,
                        response: {
                          result: `Found ${searchResults.length} matches: ${searchResults.map((m: any) => m.name).join(", ")}`
                        }
                      }]
                    });
                  }
                }
              }

              if (message.serverContent?.turnComplete) {
                console.log("✅ Turn complete - session still active, listening for next user input");
                sendSSE({ type: "turnComplete" });

                // Session remains open for multi-turn conversation
                // Microphone audio continues streaming, VAD will detect next user speech
              }
            },
            onerror: (e: ErrorEvent) => {
              console.error("❌ Gemini Live error:", e.message);
              sendSSE({ type: "error", message: e.message });
            },
            onclose: (e: CloseEvent) => {
              console.log("🎤 Gemini Live closed:", e.reason);
            },
          },
        });

        // Store session with context
        sessions.set(sessionId, {
          session,
          audioParts,
          responseQueue,
          userContext,
          searchResults,
          questionCount,
        });

        // Trigger the agent to start the conversation
        // Use sendClientContent for the initial greeting, then switch to realtime audio
        session.sendClientContent({
          turns: ["Hi, start the onboarding conversation"],
          turnComplete: true,
        });

        sendSSE({ type: "ready" });

        // Keep alive
        const keepAlive = setInterval(() => {
          sendSSE({ type: "ping" });
        }, 20000);

        // Cleanup
        req.signal.addEventListener("abort", () => {
          console.log("Client disconnected");
          clearInterval(keepAlive);
          sessions.delete(sessionId);
          session.close();
        });
      } catch (error: any) {
        console.error("Error starting voice session:", error);
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

    const sessionData = sessions.get(sessionId);
    if (!sessionData) {
      return Response.json({ error: "No active session" }, { status: 404 });
    }

    const audioData = await req.arrayBuffer();
    const base64Audio = Buffer.from(audioData).toString("base64");

    // Log every audio chunk to verify microphone is working
    console.log(`🎤 Received audio chunk: ${audioData.byteLength} bytes from browser`);

    // Send audio chunk to Gemini Live using sendRealtimeInput
    // This supports continuous streaming - VAD will detect when user speaks
    sessionData.session.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: "audio/pcm;rate=16000",
      }
    });

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("❌ Error sending audio:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
