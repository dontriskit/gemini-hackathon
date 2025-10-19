#!/usr/bin/env tsx
/**
 * Schema Analysis Script
 * Analyzes both JSON files to understand the complete data structure
 */

import fs from "fs";
import path from "path";

interface SchemaNode {
  type: string;
  count: number;
  examples: any[];
  children?: Record<string, SchemaNode>;
}

function analyzeValue(value: any): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function analyzeStructure(obj: any, depth = 0, maxExamples = 3): SchemaNode {
  const type = analyzeValue(obj);
  const node: SchemaNode = {
    type,
    count: 1,
    examples: [],
  };

  if (type === "object" && obj !== null) {
    node.children = {};
    for (const [key, value] of Object.entries(obj)) {
      node.children[key] = analyzeStructure(value, depth + 1, maxExamples);
    }
  } else if (type === "array" && Array.isArray(obj) && obj.length > 0) {
    // Analyze first few items to understand array structure
    const itemTypes = new Map<string, any>();
    obj.slice(0, 5).forEach((item) => {
      const itemType = analyzeValue(item);
      if (!itemTypes.has(itemType)) {
        itemTypes.set(itemType, item);
      }
    });

    node.children = {};
    itemTypes.forEach((example, itemType) => {
      node.children![`[${itemType}]`] = analyzeStructure(example, depth + 1, maxExamples);
    });
  } else {
    // Store examples for primitive types
    if (node.examples.length < maxExamples) {
      node.examples.push(obj);
    }
  }

  return node;
}

function mergeSchemas(schema1: SchemaNode, schema2: SchemaNode): SchemaNode {
  const merged: SchemaNode = {
    type: schema1.type === schema2.type ? schema1.type : "mixed",
    count: schema1.count + schema2.count,
    examples: [...schema1.examples, ...schema2.examples].slice(0, 5),
  };

  if (schema1.children || schema2.children) {
    merged.children = {};
    const allKeys = new Set([
      ...Object.keys(schema1.children || {}),
      ...Object.keys(schema2.children || {}),
    ]);

    allKeys.forEach((key) => {
      const child1 = schema1.children?.[key];
      const child2 = schema2.children?.[key];

      if (child1 && child2) {
        merged.children![key] = mergeSchemas(child1, child2);
      } else if (child1) {
        merged.children![key] = child1;
      } else if (child2) {
        merged.children![key] = child2;
      }
    });
  }

  return merged;
}

function printSchema(schema: SchemaNode, indent = 0, key = "root"): string {
  const prefix = "  ".repeat(indent);
  let output = "";

  if (schema.type === "object" && schema.children) {
    output += `${prefix}${key}: {\n`;
    for (const [childKey, childSchema] of Object.entries(schema.children)) {
      output += printSchema(childSchema, indent + 1, childKey);
    }
    output += `${prefix}}\n`;
  } else if (schema.type === "array" && schema.children) {
    output += `${prefix}${key}: [\n`;
    for (const [childKey, childSchema] of Object.entries(schema.children)) {
      output += printSchema(childSchema, indent + 1, childKey);
    }
    output += `${prefix}]\n`;
  } else {
    const examples = schema.examples.length > 0 ? ` (examples: ${JSON.stringify(schema.examples).slice(0, 100)})` : "";
    output += `${prefix}${key}: ${schema.type}${examples}\n`;
  }

  return output;
}

async function analyzeFiles() {
  console.log("🔍 Analyzing JSON schema structure...\n");

  const whitecontextPath = path.join(process.cwd(), "public", "unified_guests_whitecontext.json");
  const allGuestsPath = path.join(process.cwd(), "public", "unified_guests_all.json");

  console.log("📂 Loading files...");
  const whitecontextData = JSON.parse(fs.readFileSync(whitecontextPath, "utf-8"));
  const allGuestsData = JSON.parse(fs.readFileSync(allGuestsPath, "utf-8"));

  console.log(`  ✓ Whitecontext: ${whitecontextData.length} profiles`);
  console.log(`  ✓ All guests: ${allGuestsData.length} profiles`);

  // Count profiles with whitecontext data
  const withWhitecontext = whitecontextData.filter((p: any) => p.whitecontext?.enriched).length;
  console.log(`  ✓ Profiles with enriched whitecontext: ${withWhitecontext}\n`);

  // Analyze both files
  console.log("📊 Analyzing whitecontext file schema...");
  let whitecontextSchema: SchemaNode | null = null;
  whitecontextData.slice(0, 50).forEach((profile: any) => {
    const schema = analyzeStructure(profile);
    whitecontextSchema = whitecontextSchema ? mergeSchemas(whitecontextSchema, schema) : schema;
  });

  console.log("📊 Analyzing all guests file schema...");
  let allGuestsSchema: SchemaNode | null = null;
  allGuestsData.slice(0, 50).forEach((profile: any) => {
    const schema = analyzeStructure(profile);
    allGuestsSchema = allGuestsSchema ? mergeSchemas(allGuestsSchema, schema) : schema;
  });

  // Print schemas
  console.log("\n" + "=".repeat(80));
  console.log("WHITECONTEXT FILE SCHEMA (unified_guests_whitecontext.json)");
  console.log("=".repeat(80) + "\n");
  console.log(printSchema(whitecontextSchema!));

  console.log("\n" + "=".repeat(80));
  console.log("ALL GUESTS FILE SCHEMA (unified_guests_all.json)");
  console.log("=".repeat(80) + "\n");
  console.log(printSchema(allGuestsSchema!));

  // Analyze whitecontext field specifically
  console.log("\n" + "=".repeat(80));
  console.log("WHITECONTEXT FIELD DETAILS");
  console.log("=".repeat(80) + "\n");

  const whitecontextExamples = whitecontextData
    .filter((p: any) => p.whitecontext?.enriched)
    .slice(0, 3);

  whitecontextExamples.forEach((profile: any, idx: number) => {
    console.log(`\nExample ${idx + 1}: ${profile.linkedin?.firstname} ${profile.linkedin?.lastname}`);
    console.log("---");
    console.log("Company:", profile.whitecontext?.company_name);
    console.log("TLDR:", profile.whitecontext?.tldr?.slice(0, 150) + "...");
    console.log("Context Tags:", profile.whitecontext?.context_tags?.slice(0, 5).join(", "));
    console.log("Business Model:", profile.whitecontext?.business_model?.type);
    console.log("Target Market:", profile.whitecontext?.business_model?.target_market?.slice(0, 100) + "...");
    if (profile.whitecontext?.company_intelligence) {
      console.log("Growth Signals:", profile.whitecontext.company_intelligence.growth_signals?.slice(0, 3));
      console.log("Challenges:", profile.whitecontext.company_intelligence.challenge_areas?.slice(0, 3));
    }
  });

  // Generate TypeScript interface
  console.log("\n" + "=".repeat(80));
  console.log("SUGGESTED TYPESCRIPT INTERFACE");
  console.log("=".repeat(80) + "\n");

  const tsInterface = `interface GuestProfile {
  username: string;

  cerebralvalley?: {
    url?: string;
    name?: string;
    avatar?: string;
    metadata?: {
      field_1?: string; // Often contains full name
    };
  };

  linkedin?: {
    url?: string;
    profile_id?: number;
    profile_url?: string;
    handle?: string;
    firstname?: string;
    lastname?: string;
    location?: string;
    headline?: string;
    summary?: string;
    premium_account?: boolean;
  };

  contact?: {
    email?: string;
    email_status?: string;
    domain?: string;
    all_emails?: Array<{
      email: string;
      status: string;
    }>;
    phones?: any[];
    social_medias?: any[];
  };

  position?: {
    title?: string;
    description?: string;
    start_date?: {
      month?: number;
      year?: number;
    };
    end_date?: {
      month?: number;
      year?: number;
    };
  };

  company?: {
    name?: string;
    domain?: string;
    website?: string;
    linkedin_url?: string;
    linkedin_id?: number;
    industry?: string;
    description?: string;
    headcount?: number;
    headcount_range?: string;
    year_founded?: number;
    headquarters?: {
      city?: string;
      region?: string;
      country?: string;
      country_code?: string;
      address?: string;
    };
  };

  whitecontext?: {
    enriched?: boolean;
    analyzed_at?: string;
    source_url?: string;
    company_name?: string;
    tldr?: string;
    context_tags?: string[];
    business_model?: {
      type?: string;
      revenue_model?: string;
      target_market?: string;
      customer_segments?: string[];
      pricing_structure?: string;
    };
    company_profile?: {
      founded?: string;
      size_metrics?: {
        revenue?: string;
        customers?: string;
        employees?: string;
      };
      funding_status?: string;
    };
    products_services?: Array<{
      name?: string;
      description?: string;
      category?: string;
    }>;
    contact_information?: {
      website?: string;
      email?: string;
      phone?: string;
      social_media?: Record<string, string>;
    };
    company_intelligence?: {
      growth_signals?: string[];
      challenge_areas?: string[];
      market_position?: string;
      competitive_advantages?: string[];
      industry_category?: string;
    };
  };
}`;

  console.log(tsInterface);

  // Summary stats
  console.log("\n" + "=".repeat(80));
  console.log("SUMMARY STATISTICS");
  console.log("=".repeat(80) + "\n");

  const stats = {
    totalProfiles: allGuestsData.length,
    whitecontextProfiles: whitecontextData.length,
    enrichedWhitecontext: withWhitecontext,
    withLinkedIn: allGuestsData.filter((p: any) => p.linkedin?.firstname).length,
    withEmail: allGuestsData.filter((p: any) => p.contact?.email).length,
    withCompany: allGuestsData.filter((p: any) => p.company?.name).length,
  };

  console.log(`Total unique profiles: ${stats.totalProfiles}`);
  console.log(`Profiles in whitecontext file: ${stats.whitecontextProfiles}`);
  console.log(`Profiles with enriched whitecontext: ${stats.enrichedWhitecontext}`);
  console.log(`Profiles with LinkedIn data: ${stats.withLinkedIn} (${((stats.withLinkedIn / stats.totalProfiles) * 100).toFixed(1)}%)`);
  console.log(`Profiles with email: ${stats.withEmail} (${((stats.withEmail / stats.totalProfiles) * 100).toFixed(1)}%)`);
  console.log(`Profiles with company info: ${stats.withCompany} (${((stats.withCompany / stats.totalProfiles) * 100).toFixed(1)}%)`);

  console.log("\n✅ Analysis complete!\n");
}

analyzeFiles().catch(console.error);
