import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { VectaraClient } from "vectara";

/**
 * Vectara search tool for finding relevant hackathon participant profiles
 * based on user context and search criteria
 */
export const searchPeopleTool = createTool({
  id: "search-people-tool",
  description:
    "Search for hackathon participants whose profiles match the given criteria. Returns top matching profiles with relevance scores.",
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "Natural language search query describing who the user is looking for (e.g., 'ML researchers in SF', 'founders looking for technical cofounders')"
      ),
    location: z
      .string()
      .optional()
      .describe("Filter by location if specified"),
    limit: z
      .number()
      .optional()
      .default(3)
      .describe("Number of results to return (default: 3)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    matches: z.array(
      z.object({
        username: z.string(),
        name: z.string(),
        headline: z.string(),
        location: z.string(),
        summary: z.string().describe("AI-generated match summary"),
        score: z.number().describe("Relevance score from Vectara"),
        reasoning: z.string().describe("Why this person is a good match"),
        avatar: z.string().optional().describe("Profile avatar URL"),
        email: z.string().optional().describe("Contact email"),
      })
    ),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const { query, location, limit } = context;

      // Initialize Vectara client with personal API key
      const client = new VectaraClient({
        apiKey: process.env.VECTARA_API_KEY!,
      });

      // Build search query with optional location filter
      let searchQuery = query;
      if (location) {
        searchQuery = `${query} location:${location}`;
      }

      // Query Vectara for matching profiles
      const response = await client.query({
        query: searchQuery,
        search: {
          corpora: [
            {
              corpusKey: process.env.VECTARA_CORPUS_KEY || "seed-hackathon-profiles",
              lexicalInterpolation: 0.05, // Balance semantic vs keyword search
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

      console.log("Vectara response:", JSON.stringify(response, null, 2));

      // Parse results and extract profile data
      const searchResults = response.searchResults || [];

      const matches = searchResults.slice(0, limit || 3).map((result: any) => {
        // Vectara stores metadata in partMetadata (not documentMetadata!)
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

      console.log(`Found ${matches.length} matches:`, matches);

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
  },
});
