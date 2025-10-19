import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

interface CompanyData {
  url: string;
  company_name: string;
  status: string;
  gtm_intelligence: {
    tldr: string;
    company_name: string;
    context_tags: string[];
    business_model: {
      type: string;
      revenue_model: string;
      target_market: string;
      customer_segments: string[];
      pricing_structure: string;
    };
    company_profile: {
      founded: string;
      size_metrics: {
        revenue: string;
        customers: string;
        employees: string;
      };
      funding_status: string;
    };
    products_services: Array<{
      name?: string;
      description?: string;
    }>;
    contact_information: {
      website: string;
    };
    company_intelligence: {
      growth_signals: string[];
      challenge_areas: string[];
      market_position: string;
      competitive_advantages: string[];
      industry_category: string;
    };
  };
}

interface CompaniesFile {
  metadata: {
    totalResults: number;
    completedResults: number;
  };
  results: CompanyData[];
}

export const prospectLoader = createTool({
  id: 'prospect-loader',
  description: 'Loads prospect company data from the pharmaceutical companies database. Can select a specific company by name or load a random company.',
  inputSchema: z.object({
    companyName: z.string().optional().describe('Specific company name to load. If not provided, a random company will be selected.'),
  }),
  execute: async ({ context }) => {
    try {
      // Load the companies JSON file
      const filePath = path.join(process.cwd(), 'public', '220-pharma-companies.json');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const companiesData: CompaniesFile = JSON.parse(fileContent);

      let selectedCompany: CompanyData | undefined;

      if (context.companyName) {
        // Find specific company
        selectedCompany = companiesData.results.find(
          company =>
            company.company_name.toLowerCase().includes(context.companyName!.toLowerCase()) ||
            context.companyName!.toLowerCase().includes(company.company_name.toLowerCase())
        );

        if (!selectedCompany) {
          return {
            success: false,
            error: `Company "${context.companyName}" not found in database.`,
            availableCompanies: companiesData.results
              .slice(0, 10)
              .map(c => c.company_name)
              .join(', '),
          };
        }
      } else {
        // Select random company with meaningful data
        const validCompanies = companiesData.results.filter(
          company =>
            company.status === 'completed' &&
            company.gtm_intelligence?.tldr &&
            company.gtm_intelligence.tldr !== 'Unknown' &&
            !company.gtm_intelligence.tldr.includes('cannot be determined')
        );

        if (validCompanies.length === 0) {
          return {
            success: false,
            error: 'No valid companies found in database.',
          };
        }

        const randomIndex = Math.floor(Math.random() * validCompanies.length);
        selectedCompany = validCompanies[randomIndex];
      }

      // Extract and structure the company intelligence
      const intel = selectedCompany.gtm_intelligence;

      return {
        success: true,
        company: {
          name: selectedCompany.company_name,
          url: selectedCompany.url,
          tldr: intel.tldr,
          industry: intel.company_intelligence.industry_category,
          businessModel: intel.business_model.type,
          targetMarket: intel.business_model.target_market,

          // Decision maker profile (synthesized from company data)
          decisionMaker: {
            role: inferDecisionMakerRole(intel),
            concerns: inferPrimaryConcerns(intel),
            priorities: inferPriorities(intel),
          },

          // Company context
          products: intel.products_services
            .filter(p => p.name)
            .map(p => ({ name: p.name, description: p.description })),

          challenges: intel.company_intelligence.challenge_areas,
          competitiveAdvantages: intel.company_intelligence.competitive_advantages,
          marketPosition: intel.company_intelligence.market_position,

          // Financial context
          fundingStatus: intel.company_profile.funding_status,
          companySize: intel.company_profile.size_metrics,

          // Strategic context
          growthSignals: intel.company_intelligence.growth_signals,
          contextTags: intel.context_tags,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load prospect data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Helper functions to infer decision maker characteristics
function inferDecisionMakerRole(intel: CompanyData['gtm_intelligence']): string {
  const companySize = intel.company_profile.size_metrics.employees;

  if (companySize.includes('Unknown') || companySize === 'Unknown') {
    return 'Director of Operations';
  }

  // Parse employee count if available
  const employeeMatch = companySize.match(/(\d+)/);
  if (employeeMatch) {
    const count = parseInt(employeeMatch[1]);
    if (count > 500) return 'VP of Medical Technology';
    if (count > 100) return 'Director of Healthcare Innovation';
  }

  return 'Head of Medical Procurement';
}

function inferPrimaryConcerns(intel: CompanyData['gtm_intelligence']): string[] {
  const concerns: string[] = [];

  // Budget concerns
  if (intel.company_profile.funding_status.includes('Unknown') ||
      intel.business_model.pricing_structure.includes('Unknown')) {
    concerns.push('Budget constraints and ROI justification');
  }

  // Integration concerns
  if (intel.company_intelligence.competitive_advantages.some(adv =>
      adv.toLowerCase().includes('technology') ||
      adv.toLowerCase().includes('platform'))) {
    concerns.push('Integration with existing systems');
  }

  // Regulatory concerns (common in pharma/healthcare)
  concerns.push('Regulatory compliance and certifications');

  // Market position concerns
  if (intel.company_intelligence.market_position.includes('competitive')) {
    concerns.push('Competitive differentiation');
  }

  return concerns;
}

function inferPriorities(intel: CompanyData['gtm_intelligence']): string[] {
  const priorities: string[] = [];

  // Growth signals influence priorities
  if (intel.company_intelligence.growth_signals.some(signal =>
      signal.toLowerCase().includes('expansion'))) {
    priorities.push('Scaling operations efficiently');
  }

  // Challenge areas influence priorities
  if (intel.company_intelligence.challenge_areas.length > 0) {
    priorities.push('Solving current operational challenges');
  }

  // Default healthcare priorities
  priorities.push('Improving patient outcomes');
  priorities.push('Reducing operational costs');

  return priorities;
}
