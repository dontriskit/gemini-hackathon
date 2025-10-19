import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { chromium } from 'playwright';
import { runAccessibilityChecks } from '@/lib/accessibility-checker';

export const accessibilityTool = createTool({
  id: 'accessibility-checker',
  description: 'Analyzes a webpage for accessibility issues using Playwright. Returns detailed accessibility violations including missing alt text, heading hierarchy issues, form label problems, and WCAG compliance issues.',
  inputSchema: z.object({
    url: z.string().url().describe('The URL of the webpage to analyze for accessibility issues'),
  }),
  outputSchema: z.object({
    url: z.string(),
    totalIssues: z.number(),
    critical: z.number(),
    warning: z.number(),
    minor: z.number(),
    issues: z.array(z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      severity: z.enum(['critical', 'warning', 'minor']),
      location: z.string(),
      element: z.string().optional(),
    })),
    pageTitle: z.string().optional(),
    hasLangAttribute: z.boolean(),
  }),
  execute: async ({ context }) => {
    console.log('=== Accessibility Tool Execute Started ===');
    const { url } = context;
    console.log('Tool received URL:', url);
    let browser;

    try {
      // Launch Playwright browser
      console.log('Launching Playwright browser...');
      browser = await chromium.launch({ headless: true });
      const browserContext = await browser.newContext();
      const page = await browserContext.newPage();
      console.log('Browser launched successfully');

      // Navigate to the URL
      console.log('Navigating to URL...');
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('Page loaded successfully');

      // Get page metadata
      const pageTitle = await page.title();
      const htmlLang = await page.locator('html').getAttribute('lang');
      console.log('Page metadata:', { pageTitle, htmlLang });

      // Run accessibility checks
      console.log('Running accessibility checks...');
      const issues = await runAccessibilityChecks(page);
      console.log(`Found ${issues.length} accessibility issues`);

      // Close browser
      await browser.close();
      console.log('Browser closed');

      // Calculate summary
      const summary = {
        url,
        totalIssues: issues.length,
        critical: issues.filter(i => i.severity === 'critical').length,
        warning: issues.filter(i => i.severity === 'warning').length,
        minor: issues.filter(i => i.severity === 'minor').length,
        issues: issues.map(issue => ({
          id: issue.id,
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          location: issue.location,
          element: issue.element,
        })),
        pageTitle: pageTitle || undefined,
        hasLangAttribute: !!htmlLang && htmlLang.trim() !== '',
      };

      console.log('Returning summary:', summary);
      console.log('=== Accessibility Tool Execute Completed ===');
      return summary;
    } catch (error) {
      console.error('=== Accessibility Tool Error ===');
      console.error('Error:', error);
      
      if (browser) {
        await browser.close();
      }
      
      throw new Error(
        `Failed to analyze accessibility: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  },
});
