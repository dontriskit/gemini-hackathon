import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { csvParserTool } from '../tools/csv-parser-tool';
import { llmClassifierTool } from '../tools/llm-classifier-tool';
import { resultsAggregatorTool } from '../tools/results-aggregator-tool';
import { csvExportTool } from '../tools/csv-export-tool';

/**
 * Prequalification Workflow
 *
 * Orchestrates the complete lead prequalification pipeline:
 * 1. Parse CSV into prospects
 * 2. Classify each prospect in parallel (40 concurrency for Nvidia NIM rate limit)
 * 3. Aggregate and sort results by priority
 * 4. Export top N to CSV
 *
 * Key feature: `.foreach(concurrency: 40)` enforces rate limiting
 */

// Step 1: Parse CSV
const parseStep = createStep({
  id: 'parse-csv',
  description: 'Parse CSV file into prospect objects',
  inputSchema: z.object({
    fileContent: z.string(),
    fileType: z.enum(['csv', 'json']),
  }),
  outputSchema: z.object({
    prospects: z.array(z.any()),
    totalCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const runtimeContext = new RuntimeContext();
    const result = await csvParserTool.execute({
      context: {
        fileContent: inputData.fileContent,
        fileType: inputData.fileType,
      },
      runtimeContext,
    });
    return result;
  },
});

// Step 2: Classify a single prospect (will be used with .foreach)
const classifyStep = createStep({
  id: 'classify-prospect',
  description: 'Classify a single prospect using LLM',
  inputSchema: z.object({
    prospect: z.any(),
    criteriaSchema: z.any(),
    systemPrompt: z.string(),
  }),
  outputSchema: z.object({
    prospect: z.any(),
    classification: z.record(z.any()),
    success: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const runtimeContext = new RuntimeContext();
    const { prospect, criteriaSchema, systemPrompt } = inputData;

    const result = await llmClassifierTool.execute({
      context: {
        prospect,
        criteriaSchema,
        systemPrompt,
      },
      runtimeContext,
    });

    return {
      prospect: result.prospect,
      classification: result.classification,
      success: result.success,
    };
  },
});

// Step 3: Aggregate results
const aggregateStep = createStep({
  id: 'aggregate-results',
  description: 'Aggregate and sort classification results',
  inputSchema: z.object({
    classifiedProspects: z.array(z.any()),
  }),
  outputSchema: z.object({
    sortedProspects: z.array(z.any()),
    stats: z.object({
      total: z.number(),
      successful: z.number(),
      failed: z.number(),
      priorityA: z.number(),
      priorityB: z.number(),
      priorityC: z.number(),
      priorityD: z.number(),
      avgConfidence: z.number(),
    }),
  }),
  execute: async ({ inputData }) => {
    const runtimeContext = new RuntimeContext();
    const result = await resultsAggregatorTool.execute({
      context: {
        classifiedProspects: inputData.classifiedProspects,
      },
      runtimeContext,
    });
    return result;
  },
});

// Step 4: Export to CSV
const exportStep = createStep({
  id: 'export-csv',
  description: 'Export top N prospects to CSV',
  inputSchema: z.object({
    prospects: z.array(z.any()),
    topN: z.number(),
    includeReasoning: z.boolean().default(true),
  }),
  outputSchema: z.object({
    csv: z.string(),
    count: z.number(),
    filename: z.string(),
  }),
  execute: async ({ inputData }) => {
    const runtimeContext = new RuntimeContext();
    const result = await csvExportTool.execute({
      context: {
        prospects: inputData.prospects,
        topN: inputData.topN,
        includeReasoning: inputData.includeReasoning,
      },
      runtimeContext,
    });
    return result;
  },
});

// Compose the complete workflow
export const prequalificationWorkflow = createWorkflow({
  id: 'prequalification-workflow',
  description: 'Process LinkedIn exports and return top 200 qualified leads',
  inputSchema: z.object({
    fileContent: z.string(),
    fileType: z.enum(['csv', 'json']),
    criteriaSchema: z.any(),
    systemPrompt: z.string(),
    topN: z.number().default(200),
  }),
  outputSchema: z.object({
    csv: z.string(),
    filename: z.string(),
    stats: z.object({
      total: z.number(),
      successful: z.number(),
      failed: z.number(),
      priorityA: z.number(),
      priorityB: z.number(),
      priorityC: z.number(),
      priorityD: z.number(),
      avgConfidence: z.number(),
    }),
  }),
})
  // Step 1: Parse CSV into prospects array
  .then(parseStep)

  // Transform: Map each prospect to include criteria and prompt
  .map(async ({ inputData, prospects }) => {
    return prospects.map((prospect: any) => ({
      prospect,
      criteriaSchema: inputData.criteriaSchema,
      systemPrompt: inputData.systemPrompt,
    }));
  })

  // Step 2: Classify each prospect in parallel with 40 concurrency (Nvidia NIM rate limit)
  .foreach(classifyStep, { concurrency: 40 })

  // Transform: Package classified prospects for aggregation
  .map(async (classifiedProspects) => ({
    classifiedProspects,
  }))

  // Step 3: Aggregate and sort results
  .then(aggregateStep)

  // Transform: Prepare data for export, pass through stats
  .map(async ({ sortedProspects, stats }: any, { inputData }: any) => ({
    prospects: sortedProspects,
    topN: inputData.topN,
    includeReasoning: true,
    stats, // Pass stats through for final output
  }))

  // Step 4: Export top N to CSV
  .then(exportStep)

  // Transform: Final output with stats
  .map(async ({ csv, filename, stats }: any) => ({
    csv,
    filename,
    stats,
  }))

  .commit();
