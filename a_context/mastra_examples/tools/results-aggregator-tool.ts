import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Results Aggregator Tool
 *
 * Aggregates classification results and sorts by priority score.
 * Calculates statistics about the processing run.
 */

export const resultsAggregatorTool = createTool({
  id: 'results-aggregator',
  description: 'Aggregate and sort classification results by priority',

  inputSchema: z.object({
    classifiedProspects: z.array(
      z.object({
        prospect: z.any(),
        classification: z.record(z.any()),
        success: z.boolean(),
      })
    ),
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

  execute: async ({ context }) => {
    const { classifiedProspects } = context;

    // Initialize stats
    const stats = {
      total: classifiedProspects.length,
      successful: classifiedProspects.filter((p) => p.success).length,
      failed: classifiedProspects.filter((p) => !p.success).length,
      priorityA: 0,
      priorityB: 0,
      priorityC: 0,
      priorityD: 0,
      avgConfidence: 0,
    };

    // Count priorities and calculate average confidence
    let totalConfidence = 0;
    let confidenceCount = 0;

    classifiedProspects.forEach((p) => {
      if (p.success && p.classification) {
        const priority = p.classification.priority_score;

        // Count priority distribution
        if (priority === 'A') stats.priorityA++;
        else if (priority === 'B') stats.priorityB++;
        else if (priority === 'C') stats.priorityC++;
        else if (priority === 'D') stats.priorityD++;

        // Accumulate confidence scores
        const confidence = p.classification.confidence_score;
        if (typeof confidence === 'number') {
          totalConfidence += confidence;
          confidenceCount++;
        }
      }
    });

    // Calculate average confidence
    stats.avgConfidence =
      confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    // Sort by priority (A > B > C > D) and then by confidence
    const priorityOrder: Record<string, number> = {
      A: 4,
      B: 3,
      C: 2,
      D: 1,
    };

    const sortedProspects = classifiedProspects
      .filter((p) => p.success) // Only include successful classifications
      .sort((a, b) => {
        // First, sort by priority
        const priorityA = a.classification?.priority_score || 'D';
        const priorityB = b.classification?.priority_score || 'D';
        const priorityDiff =
          (priorityOrder[priorityB] || 0) - (priorityOrder[priorityA] || 0);

        if (priorityDiff !== 0) return priorityDiff;

        // If same priority, sort by confidence (higher confidence first)
        const confidenceA = a.classification?.confidence_score || 0;
        const confidenceB = b.classification?.confidence_score || 0;
        return confidenceB - confidenceA;
      })
      .map((p) => ({
        // Flatten structure for easier downstream processing
        ...p.prospect,
        ...p.classification,
      }));

    return {
      sortedProspects,
      stats,
    };
  },
});
