import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import Papa from 'papaparse';

/**
 * CSV Parser Tool
 *
 * Parses CSV or JSON file content into structured prospect objects.
 * Handles various LinkedIn export formats with inconsistent headers.
 */

export const csvParserTool = createTool({
  id: 'csv-parser',
  description: 'Parse CSV or JSON files into structured prospect records',

  inputSchema: z.object({
    fileContent: z.string().describe('Raw file content as string'),
    fileType: z.enum(['csv', 'json']).describe('File type: csv or json'),
  }),

  outputSchema: z.object({
    prospects: z.array(
      z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        fullName: z.string().optional(),
        jobTitle: z.string().optional(),
        company: z.string().optional(),
        location: z.string().optional(),
        profileUrl: z.string().optional(),
        // Preserve raw data for export
        _raw: z.record(z.any()).optional(),
      })
    ),
    totalCount: z.number(),
  }),

  execute: async ({ context }) => {
    const { fileContent, fileType } = context;

    let prospects: any[] = [];

    if (fileType === 'json') {
      // Parse JSON directly
      try {
        const parsed = JSON.parse(fileContent);
        prospects = Array.isArray(parsed) ? parsed : [parsed];
      } catch (error) {
        throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Parse CSV using papaparse
      const parseResult = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => {
          // Normalize common LinkedIn Sales Navigator headers
          const normalized = header.trim().toLowerCase();

          // Map various header formats to standard fields
          const headerMap: Record<string, string> = {
            'first name': 'firstName',
            'firstname': 'firstName',
            'last name': 'lastName',
            'lastname': 'lastName',
            'full name': 'fullName',
            'fullname': 'fullName',
            'name': 'fullName',
            'job title': 'jobTitle',
            'jobtitle': 'jobTitle',
            'title': 'jobTitle',
            'current job title': 'jobTitle',
            'company': 'company',
            'company name': 'company',
            'companyname': 'company',
            'current company': 'company',
            'organization': 'company',
            'location': 'location',
            'profile url': 'profileUrl',
            'profileurl': 'profileUrl',
            'linkedin url': 'profileUrl',
            'url': 'profileUrl',
          };

          return headerMap[normalized] || header;
        },
      });

      if (parseResult.errors.length > 0) {
        console.warn('CSV parsing warnings:', parseResult.errors);
      }

      prospects = parseResult.data;
    }

    // Normalize and clean prospect data
    const normalizedProspects = prospects.map((prospect) => {
      // Extract fullName from firstName + lastName if not present
      let fullName = prospect.fullName || '';
      if (!fullName && (prospect.firstName || prospect.lastName)) {
        fullName = [prospect.firstName, prospect.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();
      }

      // Split fullName into firstName/lastName if those are missing
      let firstName = prospect.firstName || '';
      let lastName = prospect.lastName || '';
      if (!firstName && !lastName && fullName) {
        const parts = fullName.split(' ');
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
      }

      return {
        firstName: firstName?.trim() || undefined,
        lastName: lastName?.trim() || undefined,
        fullName: fullName?.trim() || undefined,
        jobTitle: prospect.jobTitle?.trim() || undefined,
        company: prospect.company?.trim() || undefined,
        location: prospect.location?.trim() || undefined,
        profileUrl: prospect.profileUrl?.trim() || undefined,
        _raw: prospect, // Preserve original data
      };
    });

    // Filter out completely empty prospects
    const validProspects = normalizedProspects.filter(
      (p) =>
        p.fullName ||
        p.firstName ||
        p.lastName ||
        p.jobTitle ||
        p.company
    );

    return {
      prospects: validProspects,
      totalCount: validProspects.length,
    };
  },
});
