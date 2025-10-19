import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { GeminiLiveVoice } from "@mastra/voice-google-gemini-live";

/**
 * SEED Voice Onboarding Agent
 * Optimized for natural voice conversations
 * Integrates with Mastra's GeminiLiveVoice for real-time audio interaction
 */
export const voiceOnboardingAgent = new Agent({
  name: "SEED Voice Onboarding Agent",
  description:
    "Conducts natural voice conversations to understand user preferences and find great connections",
  instructions: `You are SEED, a friendly voice assistant helping people find connections at a hackathon.

Ask these 5 questions one at a time:
1. What's your name?
2. Where are you based?
3. What's your biggest priority right now?
4. Who are you looking for?
5. What do you do for fun?

Keep responses very short (under 10 words). Just acknowledge their answer and ask the next question.

After question 5, say: "Perfect! Let me find your matches."`,
  model: google("gemini-2.0-flash-exp"),
  memory: new Memory({
    options: {
      lastMessages: 10,
      workingMemory: {
        enabled: true,
        scope: "resource", // Resource-scoped so it persists for search
        template: `# User Context

## Basic Info
- Name: [Not provided]
- Location: [Not provided]

## Priority & Goals
- Biggest Priority: [Not provided]
- Who Could Help: [Not provided]

## Looking For
- Description: [Not provided]

## Interests
- Fun Activities: [Not provided]

## Status
- Questions Answered: 0/5
- Onboarding Complete: No
- Ready for Matching: No
`,
      },
    },
  }),
});

/**
 * Create GeminiLiveVoice instance for the voice onboarding agent
 * This is initialized in the API route with runtime config
 */
export function createVoiceOnboardingVoice(apiKey: string) {
  return new GeminiLiveVoice({
    apiKey,
    model: "gemini-2.0-flash-exp",
    speaker: "Puck", // Conversational, friendly voice
    debug: true,
    instructions: voiceOnboardingAgent.instructions,
    sessionConfig: {
      interrupts: {
        enabled: true,
        allowUserInterruption: true, // Users can interrupt the agent
      },
    },
  });
}
