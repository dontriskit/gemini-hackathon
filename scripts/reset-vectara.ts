#!/usr/bin/env tsx
/**
 * Reset Vectara Corpus
 * Deletes the existing corpus so we can start fresh
 */

import "dotenv/config";
import { VectaraClient } from "vectara";

async function resetVectara() {
  console.log("🗑️  SEED: Resetting Vectara corpus...\n");

  const client = new VectaraClient({
    apiKey: process.env.VECTARA_API_KEY!,
  });

  const corpusKey = process.env.VECTARA_CORPUS_KEY || "seed-hackathon-profiles";

  try {
    console.log(`Deleting corpus: ${corpusKey}...`);
    await client.corpora.delete(corpusKey);
    console.log("✅ Corpus deleted successfully!\n");
    console.log("You can now run: pnpm seed:vectara\n");
  } catch (error: any) {
    if (error.message?.includes("not found") || error.statusCode === 404) {
      console.log("ℹ️  Corpus doesn't exist (already deleted or never created)\n");
      console.log("You can now run: pnpm seed:vectara\n");
    } else {
      console.error("❌ Error deleting corpus:", error);
      throw error;
    }
  }
}

resetVectara().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
