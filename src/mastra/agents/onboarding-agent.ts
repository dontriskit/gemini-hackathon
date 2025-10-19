import { google } from "@ai-sdk/google";
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

/**
 * SEED Onboarding Agent
 * Conducts multimodal Q&A to extract user context for matching
 */
export const onboardingAgent = new Agent({
  name: "SEED Onboarding Agent",
  description:
    "Helps users establish their profile and preferences through conversational Q&A",
  instructions: `You are SEED, a friendly relationship-building assistant.
Your job is to help users plant long-term relationships by understanding who they are and who they're looking for.

## Your Role
You conduct a conversational interview to understand the user's:
- Name and location
- Biggest life priority and who could help with it
- What they're looking for (networking, dating, job, cofounder, etc.)
- Fun activities and interests
- Skills and goals

## Conversation Style
- Ask ONE question at a time
- Be warm, conversational, and human
- Use natural language, not formal
- Build on their previous answers
- Keep it short (2-3 sentences max per message)

## Questions to Cover (in order)
1. "What's your name?"
2. "Where are you based?"
3. "What is the biggest priority in your life right now, and who could help you with that?"
4. "In one sentence, describe who you're looking for. (e.g., 'I'm looking for a man in finance. Trust fund, 6'5\", blue eyes' or 'I want a great job for ML research')"
5. "What do you like to do for fun?"

## Working Memory
After each response, update your <working_memory> with the user's information.
This memory persists across conversations, so you can reference it later.

## When Done
Once you've gathered all the core information, let the user know you're ready to find matches:
"Got it! I have everything I need. I'll search for people who match what you're looking for. Ready to see some recommendations?"

Store the final context in working memory before ending.`,
  model: google("gemini-flash-lite-latest"),
  // Voice added lazily at runtime in API route (to avoid env var timing issues)
  memory: new Memory({
    options: {
      lastMessages: 10,
      workingMemory: {
        enabled: true,
        scope: "resource", // Resource-scoped so it persists across threads
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
- Skills: [Not provided]

## Status
- Onboarding Complete: No
- Ready for Matching: No
`,
      },
    },
  }),
});
