import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import Papa from 'papaparse';

/**
 * CSV Export Tool
 *
 * Exports top N prospects to CSV format.
 * Flattens prospect + classification data into a single CSV row.
 */

export const csvExportTool = createTool({
  id: 'csv-export',
  description: 'Export top N prospects to CSV format',

  inputSchema: z.object({
    prospects: z.array(z.any()),
    topN: z.number().default(200).describe('Number of top prospects to export'),
    includeReasoning: z
      .boolean()
      .default(true)
      .describe('Include LLM reasoning in export'),
  }),

  outputSchema: z.object({
    csv: z.string(),
    count: z.number(),
    filename: z.string(),
  }),

  execute: async ({ context }) => {
    const { prospects, topN, includeReasoning } = context;

    // Take top N prospects
    const topProspects = prospects.slice(0, topN);

    // Flatten prospect + classification into single objects
    const flattenedData = topProspects.map((prospect) => {
      const flattened: Record<string, any> = {};

      // Add standard prospect fields
      if (prospect.firstName) flattened.first_name = prospect.firstName;
      if (prospect.lastName) flattened.last_name = prospect.lastName;
      if (prospect.fullName) flattened.full_name = prospect.fullName;
      if (prospect.jobTitle) flattened.job_title = prospect.jobTitle;
      if (prospect.company) flattened.company = prospect.company;
      if (prospect.location) flattened.location = prospect.location;
      if (prospect.profileUrl) flattened.profile_url = prospect.profileUrl;

      // Add classification fields with llm_ prefix
      Object.entries(prospect).forEach(([key, value]) => {
        // Skip original prospect fields and internal fields
        if (
          [
            'firstName',
            'lastName',
            'fullName',
            'jobTitle',
            'company',
            'location',
            'profileUrl',
            '_raw',
          ].includes(key)
        ) {
          return;
        }

        // Skip reasoning if not included
        if (key === 'reasoning' && !includeReasoning) {
          return;
        }

        // Handle arrays (e.g., event_match fields from construction snippet)
        if (Array.isArray(value)) {
          flattened[`llm_${key}`] = value.join('|');
        } else if (value !== null && value !== undefined) {
          flattened[`llm_${key}`] = value;
        }
      });

      return flattened;
    });

    // Convert to CSV using papaparse
    const csv = Papa.unparse(flattenedData, {
      quotes: true,
      header: true,
    });

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `prequalified_leads_top${topProspects.length}_${timestamp}.csv`;

    return {
      csv,
      count: topProspects.length,
      filename,
    };
  },
});
