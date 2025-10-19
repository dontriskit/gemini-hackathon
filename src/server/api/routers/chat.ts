import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { mastra } from "@/mastra";
import { randomUUID } from "crypto";

export const chatRouter = createTRPCRouter({
  /**
   * Onboarding chat - conducts Q&A to extract user context
   */
  onboard: publicProcedure
    .input(
      z.object({
        message: z.string(),
        sessionId: z.string(),
        threadId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { message, sessionId, threadId } = input;

      const agent = mastra.getAgent("onboardingAgent");
      const currentThreadId = threadId || randomUUID();

      const response = await agent.generate(message, {
        resourceId: sessionId,
        threadId: currentThreadId,
      });

      return {
        success: true,
        message: response.text,
        threadId: currentThreadId,
      };
    }),

  /**
   * Search chat - finds and refines profile matches
   */
  search: publicProcedure
    .input(
      z.object({
        message: z.string(),
        sessionId: z.string(),
        threadId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { message, sessionId, threadId } = input;

      const agent = mastra.getAgent("searchAgent");
      const currentThreadId = threadId || randomUUID();

      const response = await agent.generate(message, {
        resourceId: sessionId,
        threadId: currentThreadId,
        maxSteps: 3, // Allow tool usage
      });

      console.log("🔍 Agent response.toolResults:", response.toolResults);
      console.log("🔍 Number of tool results:", response.toolResults?.length || 0);

      // Extract serializable data from toolResults (Mastra objects aren't JSON-safe)
      const serializableToolResults = response.toolResults?.map((toolResult: any) => ({
        toolName: toolResult.payload?.toolName || "",
        result: toolResult.payload?.result || null,
      })) || [];

      console.log("📦 Serializable tool results:", serializableToolResults);

      return {
        success: true,
        message: response.text,
        threadId: currentThreadId,
        toolResults: serializableToolResults,
      };
    }),

  /**
   * Simulator chat - role-plays networking conversation
   */
  simulate: publicProcedure
    .input(
      z.object({
        message: z.string(),
        sessionId: z.string(),
        profileUsername: z.string(),
        profileContext: z.object({
          name: z.string(),
          headline: z.string(),
          location: z.string(),
          summary: z.string(),
        }),
        threadId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { message, sessionId, profileUsername, profileContext, threadId } = input;

      const agent = mastra.getAgent("networkingSimulatorAgent");
      const currentThreadId = threadId || randomUUID();

      // Inject profile context into the first message
      const systemMessage = `You are roleplaying as: ${profileContext.name}
Headline: ${profileContext.headline}
Location: ${profileContext.location}
Summary: ${profileContext.summary}

Respond as this person in a natural networking conversation.`;

      const messages = threadId
        ? [{ role: "user" as const, content: message }]
        : [
            { role: "system" as const, content: systemMessage },
            { role: "user" as const, content: message },
          ];

      try {
        const response = await agent.generate(messages, {
          resourceId: sessionId,
          threadId: currentThreadId,
          maxSteps: 5, // Allow tool usage (Maps tool)
        });

        console.log("🎭 Simulator tool results:", response.toolResults);

        // Log detailed tool results
        response.toolResults?.forEach((tr: any) => {
          console.log(`🔧 Tool: ${tr.payload?.toolName}`);
          console.log(`📍 Result:`, JSON.stringify(tr.payload?.result, null, 2));
        });

        return {
          success: true,
          message: response.text,
          threadId: currentThreadId,
          toolResults: response.toolResults?.map((tr: any) => ({
            toolName: tr.payload?.toolName,
            result: tr.payload?.result,
          })) || [],
        };
      } catch (error: any) {
        console.error("Error in simulator:", error);

        // If memory error, try without thread
        if (error.message?.includes("getThreadById") || error.message?.includes("prepare-memory")) {
          console.log("Retrying without thread context...");
          const response = await agent.generate(messages, {
            resourceId: sessionId,
            maxSteps: 5,
          });

          return {
            success: true,
            message: response.text,
            threadId: currentThreadId,
            toolResults: response.toolResults?.map((tr: any) => ({
              toolName: tr.payload?.toolName,
              result: tr.payload?.result,
            })) || [],
          };
        }

        throw error;
      }
    }),

  /**
   * Get conversation history
   */
  getHistory: publicProcedure
    .input(
      z.object({
        threadId: z.string(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { threadId } = input;

      // Fetch from database
      const conversation = await ctx.db.query.conversations.findFirst({
        where: (conversations, { eq }) => eq(conversations.threadId, threadId),
        with: {
          messages: {
            orderBy: (messages, { asc }) => [asc(messages.timestamp)],
          },
        },
      });

      if (!conversation) {
        return { success: false, messages: [] };
      }

      return {
        success: true,
        messages: conversation.messages,
        summary: conversation.summary,
      };
    }),
});
