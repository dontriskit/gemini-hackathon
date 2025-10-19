import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * LLM Classifier Tool
 *
 * Classifies a single prospect using Nvidia NIM with custom schema.
 * Implements retry logic with temperature fallback (0.1 → 0.3 → 0.5)
 * from the Python prequalification snippets.
 */

export const llmClassifierTool = createTool({
  id: 'llm-classifier',
  description: 'Classify a single prospect using LLM with custom criteria schema',

  inputSchema: z.object({
    prospect: z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      fullName: z.string().optional(),
      jobTitle: z.string().optional(),
      company: z.string().optional(),
      location: z.string().optional(),
    }),
    criteriaSchema: z.any().describe('JSON Schema for classification output'),
    systemPrompt: z.string().describe('System prompt with classification instructions'),
  }),

  outputSchema: z.object({
    prospect: z.any(),
    classification: z.record(z.any()),
    success: z.boolean(),
    retries: z.number(),
    processingTimeMs: z.number(),
  }),

  execute: async ({ context }) => {
    const { prospect, criteriaSchema, systemPrompt } = context;

    // Temperature fallback strategy from Python snippets
    const temperatures = [0.1, 0.3, 0.5];
    let retries = 0;
    let success = false;
    let classification: Record<string, any> = {};
    const startTime = Date.now();

    // Build user message from prospect data
    const prospectName =
      prospect.fullName || `${prospect.firstName || ''} ${prospect.lastName || ''}`.trim();
    const userMessage = `Classify the following prospect:

Name: ${prospectName || 'Not provided'}
Job Title: ${prospect.jobTitle || 'Not provided'}
Company: ${prospect.company || 'Not provided'}
Location: ${prospect.location || 'Not provided'}

Provide a detailed classification based on the criteria.`;

    // Retry loop with temperature fallback
    while (retries < 3 && !success) {
      try {
        const apiKey = process.env.NVIDIA_API_KEY;
        if (!apiKey) {
          throw new Error('NVIDIA_API_KEY not configured');
        }

        const response = await fetch(
          'https://integrate.api.nvidia.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'nvidia/qwen/qwen3-coder-480b-a35b-instruct',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage },
              ],
              temperature: temperatures[retries],
              max_tokens: 1024,
              // Nvidia NIM supports structured output via response_format
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'classification',
                  strict: true,
                  schema: criteriaSchema,
                },
              },
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Nvidia NIM API error (${response.status}): ${errorText}`
          );
        }

        const result = await response.json();
        const content = result.choices?.[0]?.message?.content;

        if (!content) {
          throw new Error('No content in API response');
        }

        // Parse JSON response
        classification = JSON.parse(content);

        // Validate all required fields are present
        const requiredFields = criteriaSchema.required || [];
        const allFieldsPresent = requiredFields.every(
          (field: string) =>
            field in classification && classification[field] !== null
        );

        if (allFieldsPresent) {
          success = true;
        } else {
          const missingFields = requiredFields.filter(
            (field: string) => !(field in classification)
          );
          console.warn(
            `Attempt ${retries + 1}: Missing required fields:`,
            missingFields
          );
          retries++;
        }
      } catch (error) {
        console.error(
          `Classification attempt ${retries + 1} failed:`,
          error instanceof Error ? error.message : String(error)
        );
        retries++;

        // Exponential backoff before retry
        if (retries < 3) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retries)
          );
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    // If all retries failed, return fallback classification
    if (!success) {
      console.error(
        `Classification failed for ${prospectName} after 3 retries`
      );

      // Construct minimal fallback classification
      classification = {
        reasoning: 'Classification failed after 3 retries - insufficient data',
        priority_score: 'D',
        confidence_score: 0.0,
      };
    }

    return {
      prospect,
      classification,
      success,
      retries,
      processingTimeMs,
    };
  },
});
