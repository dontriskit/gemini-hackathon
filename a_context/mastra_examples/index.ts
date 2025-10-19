
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { PostgresStore } from '@mastra/pg';
import { procurementAgent } from './agents/procurement-agent';
import { salesTrainingAgent } from './agents/sales-training-agent';
import { networkingInitiatorAgent } from './agents/networking-initiator-agent';
import { networkingRecipientAgent } from './agents/networking-recipient-agent';
import { criteriaGenerationAgent } from './agents/criteria-generation-agent';
import { prequalificationWorkflow } from './workflows/prequalification-workflow';

export const mastra = new Mastra({
  agents: {
    procurementAgent,
    salesTrainingAgent,
    networkingInitiatorAgent,
    networkingRecipientAgent,
    criteriaGenerationAgent,
  },
  workflows: {
    prequalificationWorkflow,
  },
  // PostgreSQL storage for memory persistence
  storage: new PostgresStore({
    connectionString: process.env.DATABASE_URL!,
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  telemetry: {
    // Telemetry is deprecated and will be removed in the Nov 4th release
    enabled: false,
  },
  observability: {
    // Disabled due to JSON serialization issues with PostgreSQL
    default: { enabled: false },
  },
});
