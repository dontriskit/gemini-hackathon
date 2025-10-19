import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";

/**
 * Google Maps grounding tool for suggesting meetup locations
 * Uses Gemini's Maps integration to find relevant places near SHACK15 SF
 */
export const mapsTool = createTool({
  id: "maps-tool",
  description:
    "Find meetup locations near SHACK15 in San Francisco based on user preferences (coffee shops, restaurants, coworking spaces, etc.). Use this when conversation reaches a point to suggest meeting in person.",
  inputSchema: z.object({
    placeType: z
      .string()
      .describe(
        "Type of place to search for (e.g., 'coffee shop', 'restaurant', 'coworking space', 'bar', 'cafe')"
      ),
    walkingDistance: z
      .number()
      .optional()
      .default(15)
      .describe("Walking distance in minutes from SHACK15 (default: 15)"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    suggestions: z.array(
      z.object({
        name: z.string(),
        address: z.string(),
        url: z.string().optional(),
        description: z.string().optional(),
      })
    ),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    console.log("🗺️ Maps tool called with:", context);

    try {
      const { placeType, walkingDistance } = context;

      // SHACK15 coordinates in San Francisco
      // TODO: Update with actual SHACK15 location
      const shack15Location = {
        latitude: 37.7749,
        longitude: -122.4194,
      };

      console.log(`🗺️ Searching for ${placeType} within ${walkingDistance} min of SHACK15...`);

      // Initialize Google AI with Maps grounding
      const genAI = new GoogleGenAI({
        apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
      });

      const response = await genAI.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: `What are the best ${placeType} within a ${walkingDistance}-minute walk from here? Give me 3 specific recommendations.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: shack15Location,
            },
          },
        },
      });

      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

      console.log("🗺️ Grounding metadata:", JSON.stringify(groundingMetadata, null, 2));
      console.log("🗺️ Response text:", response.text);

      // Extract grounded locations from Maps
      const suggestions = groundingMetadata?.groundingChunks
        ?.filter((chunk: any) => chunk.maps)
        .slice(0, 3)
        .map((chunk: any) => ({
          name: chunk.maps?.title || "Location",
          address: chunk.maps?.uri || "",
          url: chunk.maps?.uri || "",
          description: response.text || "",
        })) || [];

      console.log(`🗺️ Extracted ${suggestions.length} suggestions from Maps grounding`);

      // Fallback if no grounded results
      if (suggestions.length === 0) {
        console.log("🗺️ No Maps grounding data, using fallback suggestions");
        return {
          success: true,
          suggestions: [
            {
              name: "Sightglass Coffee",
              address: "270 7th St, San Francisco, CA 94103",
              url: "https://maps.google.com/?q=Sightglass+Coffee+270+7th+St+San+Francisco",
              description: "Popular coffee shop with great atmosphere",
            },
            {
              name: "Philz Coffee",
              address: "201 Berry St, San Francisco, CA 94158",
              url: "https://maps.google.com/?q=Philz+Coffee+201+Berry+St+San+Francisco",
              description: "Custom coffee blends in relaxed setting",
            },
            {
              name: "Blue Bottle Coffee",
              address: "66 Mint St, San Francisco, CA 94103",
              url: "https://maps.google.com/?q=Blue+Bottle+Coffee+66+Mint+St+San+Francisco",
              description: "Minimalist cafe perfect for meetings",
            },
          ],
        };
      }

      return {
        success: true,
        suggestions,
      };
    } catch (error) {
      console.error("Error with Maps grounding:", error);

      // Fallback to static suggestions
      return {
        success: true,
        suggestions: [
          {
            name: "Sightglass Coffee",
            address: "270 7th St, San Francisco, CA 94103",
            url: "https://maps.google.com/?q=Sightglass+Coffee+SF",
            description: "Popular coffee shop near SHACK15",
          },
          {
            name: "Philz Coffee",
            address: "201 Berry St, San Francisco, CA 94158",
            url: "https://maps.google.com/?q=Philz+Coffee+SF",
            description: "Custom coffee blends",
          },
        ],
      };
    }
  },
});
