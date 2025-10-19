import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const biocamContext = createTool({
  id: 'biocam-context',
  description: 'Provides comprehensive information about BioCam products, features, and value propositions for sales conversations.',
  inputSchema: z.object({
    aspect: z.enum(['overview', 'products', 'technical', 'benefits', 'awards', 'all']).optional()
      .describe('Specific aspect of BioCam to retrieve. Defaults to "all" for complete context.'),
  }),
  execute: async ({ context }) => {
    try {
      // Load BioCam content
      const filePath = path.join(process.cwd(), 'biocam.md');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Structured BioCam information
      const biocamInfo = {
        company: {
          name: 'BioCam',
          tagline: 'Medical imaging powered by AI',
          mission: 'Develop a new, completely safe and non-invasive endoscopic capsule-based system for gastrointestinal observation and diagnosis',
          location: 'Rybacka 7 / 300, 53-656 Wroclaw, Poland, EU',
          contact: 'contact@biocam.ai',
          team: {
            size: '40 team members',
            advisors: '10 partnering advisors and industry experts',
            medicalExperiments: '1',
            cooperatingFacilities: '3 medical facilities',
          },
        },

        products: [
          {
            name: 'BioCam® Endoscopic Capsule',
            description: 'Endoscopic capsule for imaging of the digestive system for real-time determination of potential threats',
            specifications: {
              size: '11mm wide × 23mm long',
              features: [
                'Wireless camera technology',
                'Captures thousands of pictures',
                'Real-time imaging',
                'Safe and non-invasive',
                'Can be used at home by patients',
              ],
            },
            applications: [
              "Crohn's disease detection",
              'Celiac disease diagnosis',
              'Small bowel tumor identification',
              'Anemia of unexplained origin',
            ],
          },
          {
            name: 'BioCam® Telemedicine Platform',
            description: 'Proprietary AI-powered software for automatic detection and real-time determination of potential threats',
            features: [
              'AI-powered automatic detection',
              'Real-time monitoring',
              'Remote physician access',
              'Cloud-based data storage',
              'Comprehensive reporting',
            ],
          },
          {
            name: 'BioCam® Mobile Application',
            description: 'Patient-friendly app providing preparation instructions and examination guidance',
            features: [
              'Examination preparation guide',
              'Step-by-step instructions',
              'Patient education resources',
              'Convenient home use support',
            ],
          },
        ],

        keyBenefits: {
          forHospitals: [
            'Complete gastrointestinal tract visualization',
            'AI-powered real-time threat detection',
            'Remote monitoring capabilities',
            'Reduced need for invasive procedures',
            'Cost-effective diagnostic solution',
            'Improved patient comfort and compliance',
          ],
          forPatients: [
            'Safe, non-invasive procedure',
            'Can be performed at home',
            'No sedation required',
            'Comprehensive GI tract examination',
            'Quick and convenient',
            'Clear preparation instructions via mobile app',
          ],
          competitive: [
            'AI-powered detection sets it apart from basic capsule endoscopy',
            'Integrated telemedicine platform (not just hardware)',
            'Patient-focused mobile app ecosystem',
            'Real-time monitoring vs traditional delayed review',
            'Complete system solution (device + software + support)',
          ],
        },

        technicalDetails: {
          preparation: 'Stop eating and drinking approximately 12 hours before examination',
          procedure: 'Swallow pill-sized capsule; it passes naturally through digestive system',
          imaging: 'Thousands of pictures captured and transmitted to recording device',
          analysis: 'AI-powered platform analyzes images for potential threats',
          results: 'Physicians review comprehensive report with AI-highlighted concerns',
        },

        awardsAndRecognition: [
          'Grand Prix - Innowacyjny Lider 2024',
          'Recognition by Minister of Science',
          'Carpathian Startup Fest 2024 - Scale Up 2nd place + 2 special prizes',
          'WT Innovation World Cup - 3rd place',
          'Emerging Europe Awards 2023 - Health and Social Care Initiative',
          'Santander X Startup Awards 2023 - 1st place',
          'Scale-Up by UK Business and Trade - Recognition',
          'Made in Wroclaw 2023 - 1st place',
          'DeepTech Trial by Fire - 1st place',
          'Evolutions 2023 - 1st place + special award',
        ],

        marketPosition: {
          stage: 'Growth-stage MedTech company with multiple awards',
          validation: 'Recognized by European innovation programs',
          partnerships: 'Collaborating with KTH, Google, medical facilities',
          funding: 'EU-backed with NCBR support',
        },
      };

      // Return requested aspect or all
      const aspect = context.aspect || 'all';

      switch (aspect) {
        case 'overview':
          return {
            success: true,
            data: {
              company: biocamInfo.company,
              marketPosition: biocamInfo.marketPosition,
            },
          };
        case 'products':
          return {
            success: true,
            data: {
              products: biocamInfo.products,
            },
          };
        case 'technical':
          return {
            success: true,
            data: {
              technicalDetails: biocamInfo.technicalDetails,
              specifications: biocamInfo.products[0].specifications,
            },
          };
        case 'benefits':
          return {
            success: true,
            data: {
              keyBenefits: biocamInfo.keyBenefits,
            },
          };
        case 'awards':
          return {
            success: true,
            data: {
              awards: biocamInfo.awardsAndRecognition,
              marketPosition: biocamInfo.marketPosition,
            },
          };
        default:
          return {
            success: true,
            data: biocamInfo,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to load BioCam context: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});
