import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { PostgresStore } from "@mastra/pg";

// Import agents
import { onboardingAgent } from "./agents/onboarding-agent";
import { voiceOnboardingAgent } from "./agents/voice-onboarding-agent";
import { searchAgent } from "./agents/search-agent";
import { networkingSimulatorAgent } from "./agents/networking-simulator-agent";

// Import tools
import { searchPeopleTool } from "./tools/search-people-tool";
import { mapsTool } from "./tools/maps-tool";

/**
 * SEED Mastra Instance
 * Orchestrates all agents and tools for the relationship-building app
 */
export const mastra = new Mastra({
  agents: {
    onboardingAgent,
    voiceOnboardingAgent,
    searchAgent,
    networkingSimulatorAgent,
  },
  // PostgreSQL storage for memory persistence
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  logger: new PinoLogger({
    name: "SEED",
    level: "info",
  }),
  telemetry: {
    enabled: false,
  },
  observability: {
    default: { enabled: false },
  },
});

// Export tools for external use
export { searchPeopleTool, mapsTool };
