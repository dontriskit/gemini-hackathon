# SEED: Relationship Navigator

SEED helps you find the people who can unlock your next chapter—investors, co-founders, mentors, collaborators, or even the spark for a new relationship. Share what you need using text or voice, and the system guides you through a focused dialogue to surface the strongest matches.

<img src="./Relationship.png" alt="description" width="50%">

## Highlights

- Multimodal onboarding captures context-rich requests from text or audio.
- Guided match interviews ask clarifying questions and adapt to your goals.
- Persona-aware search returns investors, founders, operators, or romantic matches.
- AI-powered profile cards summarize why each connection matters.
- Vectara-backed retrieval keeps recommendations grounded in the latest profiles.
- Optional Google Maps grounding suggests meeting spots near SHACK15 in SF or wherever you are.

## How It Works

1. **Capture intent** — Gemini Flash 2.5 ingests text or recorded voice notes and extracts goals, constraints, and vibes.
2. **Clarify** — A Mastra agent steers a short Q&A to tighten the brief and highlight must-haves.
3. **Retrieve** — Vectara vector search + Postgres metadata surface the closest matching people.
4. **Guide** — SEED presents curated cards, conversation starters, and follow-up prompts to help you act.

## Stack

- Next.js 15 + React 19 + Tailwind CSS on the T3 stack foundation.
- Drizzle ORM with PostgreSQL for structured profile and session data.
- Mastra agents orchestrating Gemini multimodal prompts.
- Vectara for retrieval-augmented matching and memory.
- Optional Google Maps grounding for location-aware suggestions.

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Update `.env` with:

- `DATABASE_URL` pointing to your local or hosted Postgres instance.
- `GOOGLE_GENERATIVE_AI_API_KEY` for Gemini.
- `VECTARA_API_KEY` and `VECTARA_CORPUS_KEY` for profile retrieval.
- (Optional) `GOOGLE_MAPS_API_KEY` if you want grounded location recommendations.

### 3. Start the development database

```bash
./start-database.sh
pnpm db:migrate
```

The script requires Docker or Podman and will spin up a Postgres container that matches `DATABASE_URL`.

### 4. Seed retrieval memory (optional but recommended)

```bash
pnpm seed:vectara
# pnpm reset:vectara to wipe and reload
```

These scripts upload sample profiles and narratives so recommendations feel grounded instantly.

### 5. Launch the app

```bash
pnpm dev
```

Visit `http://localhost:3000` to start matchmaking with SEED.

## Development Toolbox

- `pnpm check` runs linting plus TypeScript.
- `pnpm format:write` keeps the repo aligned with Prettier and Tailwind class ordering.
- `pnpm db:studio` opens the Drizzle schema explorer.
- `pnpm preview` builds and runs a production bundle locally.

## Project Structure

| Path | Description |
| ---- | ----------- |
| `src/` | Next.js application code, UI, and agent orchestration. |
| `drizzle/` | Schema snapshots for migrations. |
| `scripts/` | Utility scripts for Vectara seeding and maintenance. |
| `data/` | Starter datasets and conversation prompts used during demos. |
| `a_context/` | Reference material and agent prompt examples. |


## Contributing

1. Fork and clone the repo.
2. Create a feature branch (`git checkout -b feat/amazing-idea`).
3. Follow the scripts above to run checks.
4. Open a pull request with context about the scenario you improved.

---

SEED was crafted for the Cerebral Valley TED AI Hackathon to prove that the right prompts—and the right people—can change everything. Dive in, explore, and help us grow the network.
