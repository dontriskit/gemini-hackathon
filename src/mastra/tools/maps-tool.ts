import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Google Maps grounding tool for suggesting meetup locations
 * Uses Gemini's Maps integration to find relevant places near SHACK15 SF
 */
export const mapsTool = createTool({
  id: "maps-tool",
  description:
    "Find meetup locations near SHACK15 in San Francisco based on user preferences (coffee shops, restaurants, coworking spaces, etc.)",
  inputSchema: z.object({
    placeType: z
      .string()
      .describe(
        "Type of place to search for (e.g., 'coffee shop', 'restaurant', 'coworking space', 'bar')"
      ),
    radius: z
      .number()
      .optional()
      .default(15)
      .describe("Search radius in minutes walking distance (default: 15)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    suggestions: z.array(
      z.object({
        name: z.string(),
        address: z.string(),
        description: z.string(),
        walkingTime: z.string().optional(),
      })
    ),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    try {
      const { placeType, radius } = context;

      // SHACK15 coordinates in San Francisco
      const shack15Location = {
        latitude: 37.7749, // Approximate SF coordinates - update with actual SHACK15 location
        longitude: -122.4194,
      };

      // Note: This is a simplified implementation
      // In production, you would use the Google Gemini Maps API:
      // https://ai.google.dev/gemini-api/docs/grounding#grounding_with_google_maps

      // For the hackathon, we'll use a static response
      // Replace with actual Gemini Maps API call
      const suggestions = [
        {
          name: "Sightglass Coffee",
          address: "270 7th St, San Francisco, CA 94103",
          description: "Popular coffee shop with great atmosphere for meetings",
          walkingTime: "5 minutes",
        },
        {
          name: "Philz Coffee",
          address: "201 Berry St, San Francisco, CA 94158",
          description: "Custom coffee blends in a relaxed setting",
          walkingTime: "8 minutes",
        },
        {
          name: "Blue Bottle Coffee",
          address: "66 Mint St, San Francisco, CA 94103",
          description: "Minimalist cafe perfect for focused conversations",
          walkingTime: "10 minutes",
        },
      ];

      return {
        success: true,
        suggestions,
      };
    } catch (error) {
      console.error("Error finding locations:", error);
      return {
        success: false,
        suggestions: [],
        error: `Failed to find locations: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
