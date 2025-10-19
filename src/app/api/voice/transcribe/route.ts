import { mastra } from "@/mastra";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as Blob;

    if (!audioFile) {
      return Response.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Get onboarding agent with voice capabilities
    const agent = mastra.getAgent("onboardingAgent");

    // Convert blob to stream
    const buffer = await audioFile.arrayBuffer();
    const { Readable } = await import("stream");
    const audioStream = Readable.from(Buffer.from(buffer));

    // Transcribe using Gemini Live voice
    const transcript = await agent.voice!.listen(audioStream);

    console.log("🎤 Transcribed:", transcript);

    return Response.json({
      success: true,
      transcript,
    });
  } catch (error: any) {
    console.error("Voice transcription error:", error);
    return Response.json(
      {
        success: false,
        error: error.message || "Transcription failed",
      },
      { status: 500 }
    );
  }
}
