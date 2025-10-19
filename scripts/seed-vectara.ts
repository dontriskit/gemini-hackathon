#!/usr/bin/env tsx
/**
 * SEED Vectara Data Processing & Seeding Script
 * Processes ALL hackathon participant profiles with FULL context
 */

import "dotenv/config";
import { VectaraClient } from "vectara";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import fs from "fs";
import path from "path";

interface GuestProfile {
  username: string;
  cerebralvalley?: {
    url?: string;
    name?: string;
    metadata?: {
      field_1?: string;
    };
  };
  linkedin?: {
    firstname?: string;
    lastname?: string;
    location?: string;
    headline?: string;
    summary?: string;
    handle?: string;
  };
  contact?: {
    email?: string;
    phones?: any[];
  };
  position?: {
    title?: string;
    description?: string;
  };
  company?: {
    name?: string;
    industry?: string;
    description?: string;
  };
  whitecontext?: {
    enriched?: boolean;
    company_name?: string;
    tldr?: string;
    context_tags?: string[];
    business_model?: {
      type?: string;
      target_market?: string;
    };
    products_services?: Array<{ name?: string; description?: string }>;
    company_intelligence?: {
      growth_signals?: string[];
      challenge_areas?: string[];
      competitive_advantages?: string[];
    };
  };
}

async function generateMatchSummary(profile: GuestProfile): Promise<string> {
  const name =
    profile.linkedin?.firstname && profile.linkedin?.lastname
      ? `${profile.linkedin.firstname} ${profile.linkedin.lastname}`
      : profile.cerebralvalley?.metadata?.field_1 || profile.username;

  // Extract ALL available context
  const headline = profile.linkedin?.headline || profile.position?.title || "";
  const location = profile.linkedin?.location || "";
  const linkedinSummary = profile.linkedin?.summary || "";

  // Rich whitecontext data
  const hasWhitecontext = profile.whitecontext?.enriched;
  const companyTLDR = profile.whitecontext?.tldr || "";
  const contextTags = profile.whitecontext?.context_tags?.join(", ") || "";
  const companyName = profile.whitecontext?.company_name || profile.company?.name || "";
  const industry = profile.company?.industry || "";
  const targetMarket = profile.whitecontext?.business_model?.target_market || "";
  const growthSignals = profile.whitecontext?.company_intelligence?.growth_signals?.join(", ") || "";
  const challenges = profile.whitecontext?.company_intelligence?.challenge_areas?.join(", ") || "";

  // Build comprehensive context for AI
  const contextParts = [
    `Name: ${name}`,
    headline && `Role: ${headline}`,
    location && `Location: ${location}`,
    linkedinSummary && `Bio: ${linkedinSummary}`,
    companyName && `Company: ${companyName}`,
    industry && `Industry: ${industry}`,
    companyTLDR && `Company Context: ${companyTLDR}`,
    contextTags && `Expertise: ${contextTags}`,
    targetMarket && `Target Market: ${targetMarket}`,
    growthSignals && `Growth Focus: ${growthSignals}`,
    challenges && `Challenges: ${challenges}`,
  ].filter(Boolean).join("\n");

  const prompt = `Create a concise 2-3 sentence summary optimized for matching this person with others at a tech hackathon.

${contextParts}

Focus on:
- What they do and their expertise
- What value they could provide in networking
- What they might be looking for (based on challenges/growth signals)

Keep it conversational and under 75 words. Be specific about their domain and interests.`;

  try {
    const { text } = await generateText({
      model: google("gemini-flash-lite-latest"), // Using gemini-flash-lite-latest as specified
      prompt,
    });
    return text.trim();
  } catch (error) {
    console.error(`Error generating summary for ${name}:`, error);
    // Fallback: create basic summary from available data
    const fallback = [
      name,
      headline,
      hasWhitecontext && contextTags ? `Expertise: ${contextTags.split(",").slice(0, 3).join(", ")}` : "",
    ].filter(Boolean).join(" - ");
    return fallback.slice(0, 300);
  }
}

async function seedVectara() {
  console.log("🌱 SEED: Starting Vectara data processing with FULL context...\n");

  // Load BOTH data files
  const whitecontextPath = path.join(process.cwd(), "public", "unified_guests_whitecontext.json");
  const allGuestsPath = path.join(process.cwd(), "public", "unified_guests_all.json");

  console.log("📂 Loading data files...");
  const whitecontextData: GuestProfile[] = JSON.parse(fs.readFileSync(whitecontextPath, "utf-8"));
  const allGuestsData: GuestProfile[] = JSON.parse(fs.readFileSync(allGuestsPath, "utf-8"));

  console.log(`  ✓ Whitecontext profiles: ${whitecontextData.length}`);
  console.log(`  ✓ All guests: ${allGuestsData.length}`);

  // Merge profiles: whitecontext takes priority
  const profileMap = new Map<string, GuestProfile>();

  // First, add all whitecontext profiles (priority)
  for (const profile of whitecontextData) {
    profileMap.set(profile.username, profile);
  }

  // Then, add profiles from all_guests that aren't already in whitecontext
  for (const profile of allGuestsData) {
    if (!profileMap.has(profile.username)) {
      profileMap.set(profile.username, profile);
    }
  }

  const profiles = Array.from(profileMap.values());
  console.log(`\n📊 Total unique profiles to process: ${profiles.length}\n`);

  // Initialize Vectara client
  const client = new VectaraClient({
    apiKey: process.env.VECTARA_API_KEY!,
  });

  const corpusKey = process.env.VECTARA_CORPUS_KEY || "seed-hackathon-profiles";

  // Create corpus if it doesn't exist
  try {
    console.log(`📁 Ensuring corpus exists: ${corpusKey}...`);
    await client.corpora.create({
      key: corpusKey,
      name: "SEED Hackathon Profiles",
      description: "Complete hackathon participant profiles with rich context for relationship matching",
    });
    console.log("✅ Corpus created\n");
  } catch (error: any) {
    if (error.message?.includes("already exists") || error.statusCode === 409) {
      console.log("ℹ️  Corpus already exists, continuing...\n");
    } else {
      console.error("❌ Error with corpus:", error);
      throw error;
    }
  }

  // Process profiles with rate limiting
  const batchSize = 5;
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < profiles.length; i += batchSize) {
    const batch = profiles.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(profiles.length / batchSize);

    console.log(`\n🔄 Processing batch ${batchNum}/${totalBatches} (profiles ${i + 1}-${Math.min(i + batchSize, profiles.length)})...`);

    for (const profile of batch) {
      try {
        const name =
          profile.linkedin?.firstname && profile.linkedin?.lastname
            ? `${profile.linkedin.firstname} ${profile.linkedin.lastname}`
            : profile.cerebralvalley?.metadata?.field_1 || profile.username;

        console.log(`  Processing: ${name}...`);

        // Generate AI summary with FULL context
        const aiSummary = await generateMatchSummary(profile);

        // Prepare comprehensive document for Vectara
        const headline = profile.linkedin?.headline || profile.position?.title || "No headline";
        const location = profile.linkedin?.location || "Location not specified";
        const linkedinSummary = profile.linkedin?.summary || "";
        const contextTags = profile.whitecontext?.context_tags?.join(", ") || "";
        const companyTLDR = profile.whitecontext?.tldr || "";

        // Combine ALL text for optimal search
        const searchableText = [
          `${name}`,
          `${headline}`,
          `Location: ${location}`,
          linkedinSummary && `Bio: ${linkedinSummary}`,
          contextTags && `Expertise: ${contextTags}`,
          companyTLDR && `Company: ${companyTLDR}`,
          `AI Summary: ${aiSummary}`,
        ].filter(Boolean).join("\n\n");

        // Upload to Vectara with comprehensive metadata
        await client.documents.create(corpusKey, {
          body: {
            id: profile.username,
            type: "core",
            documentParts: [
              {
                text: searchableText,
                metadata: {
                  username: profile.username,
                  name,
                  headline,
                  location,
                  summary: aiSummary,
                  email: profile.contact?.email || "",
                  company: profile.whitecontext?.company_name || profile.company?.name || "",
                  industry: profile.company?.industry || "",
                  context_tags: contextTags,
                  has_whitecontext: profile.whitecontext?.enriched ? "true" : "false",
                  linkedin_handle: profile.linkedin?.handle || "",
                },
              },
            ],
          },
        });

        processed++;
        console.log(`    ✓ Uploaded (${processed}/${profiles.length})`);

        // Rate limiting: 2 seconds per profile (30/min, well under 60 RPM limit for flash-8b)
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        errors++;
        console.error(`    ✗ Error processing ${profile.username}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  console.log(`\n✅ Vectara seeding complete!`);
  console.log(`   Processed: ${processed}/${profiles.length} profiles`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Success rate: ${((processed / profiles.length) * 100).toFixed(1)}%`);
}

// Run the seeding script
seedVectara().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
