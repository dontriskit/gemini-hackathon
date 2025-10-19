import Link from "next/link";
import { HydrateClient } from "@/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/20 to-background">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          {/* Hero Section */}
          <div className="flex flex-col items-center gap-4 text-center">
            <h1 className="text-6xl font-bold tracking-tight sm:text-7xl">
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                SEED
              </span>
            </h1>
            <p className="max-w-2xl text-xl text-muted-foreground">
              Plant long-term relationships at the hackathon.
            </p>
            <p className="max-w-xl text-lg text-muted-foreground">
              Connect with founders, researchers, and builders using AI-powered matching
              and conversation simulation.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/onboard"
              className="flex items-center justify-center rounded-lg bg-primary px-8 py-3 text-lg font-semibold text-primary-foreground transition-all hover:bg-primary/90"
            >
              Start Finding Connections
            </Link>
            <Link
              href="/search"
              className="flex items-center justify-center rounded-lg border border-border bg-card px-8 py-3 text-lg font-semibold text-card-foreground transition-all hover:bg-accent"
            >
              Browse Participants
            </Link>
          </div>

          {/* How It Works */}
          <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
                🌱
              </div>
              <h3 className="text-xl font-bold">1. Tell Us About You</h3>
              <p className="text-sm text-muted-foreground">
                Quick Q&A to understand your goals, interests, and who you're looking for
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
                🔍
              </div>
              <h3 className="text-xl font-bold">2. Find Your Matches</h3>
              <p className="text-sm text-muted-foreground">
                AI searches hackathon participants to find the best connections for you
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-2xl">
                💬
              </div>
              <h3 className="text-xl font-bold">3. Practice & Connect</h3>
              <p className="text-sm text-muted-foreground">
                Simulate conversations and get personalized icebreakers before meeting
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>Built for the Cerebral Valley Gemini Hackathon</p>
            <p className="mt-1">Powered by Google Gemini 2.0 Flash & Mastra.ai</p>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
