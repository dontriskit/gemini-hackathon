# 🌱 SEED - Start Here!

## ✅ Everything is Ready!

All issues fixed, all 424 profiles seeded, ready to demo!

---

## 🚀 Quick Start

```bash
# Start the development server
pnpm dev

# Visit http://localhost:3000
```

---

## ✅ What's Fixed

| Issue | Status | Fix |
|-------|--------|-----|
| Duplicate messages | ✅ Fixed | Removed auto-send on mount |
| Matches not loading | ✅ Fixed | Corrected Vectara response parsing |
| Raw markdown | ✅ Fixed | Added react-markdown with custom renderers |
| Missing context | ✅ Fixed | Using full LinkedIn + Whitecontext data |
| Rate limits | ✅ Fixed | Using gemini-flash-lite-latest everywhere |

---

## 🎯 Test the Flow

### 1. Landing Page (/)
Click "Start Finding Connections" →

### 2. Onboarding (/onboard)
Chat with SEED agent:
```
Agent: What's your name?
You: Alex

Agent: Where are you based?
You: San Francisco

Agent: What's your biggest priority...
You: Finding a technical cofounder

Agent: Who are you looking for?
You: Full-stack engineer with ML experience

Agent: What do you like to do for fun?
You: Hiking and hackathons

[Click "Continue to Search"]
```

### 3. Search (/search)
```
You: find me founders working on AI

Agent: [Searches Vectara]
Agent: Here are 3 people who match...

**1. Dilip Adityan** - CEO & Founder
📍 San Francisco Bay Area
✨ Why: Building AI sales platform...

[Profile cards appear on right →]
[Click "Simulate Conversation"]
```

### 4. Simulator (/simulate/username)
```
You: Hi! Saw your profile, let's connect.
Agent (as match): Hey! What are you working on?
You: Building an AI startup...
[Natural conversation]
```

---

## 🔍 Behind the Scenes

### Data Pipeline
- ✅ 424 unique hackathon profiles
- ✅ 352 with rich whitecontext (company intelligence)
- ✅ Merged from 2 JSON files (whitecontext priority)
- ✅ AI summaries generated for each profile
- ✅ Uploaded to Vectara with full metadata

### Search Process
1. User describes criteria
2. Search Agent uses searchPeopleTool
3. Tool queries Vectara semantic search
4. Returns top 3 matches with scores
5. Agent formats as markdown
6. UI displays chat + profile cards

### Tech Stack
- **AI**: Google Gemini Flash Lite (all agents)
- **RAG**: Vectara semantic search
- **Framework**: Mastra.ai with PostgreSQL memory
- **Frontend**: Next.js 15, tRPC, shadcn/ui
- **Rendering**: react-markdown with custom components

---

## 📊 Database Status

```sql
✅ gemini-hackathon_user_session       - Session tracking
✅ gemini-hackathon_user_context       - Onboarding Q&A results
✅ gemini-hackathon_conversation       - Public conversation storage
✅ gemini-hackathon_chat_message       - Message history
✅ gemini-hackathon_match              - Profile recommendations
```

All migrations pushed ✅

---

## 🐛 Debugging Tips

### If search returns no matches:
- Check browser console for: `Vectara response:` and `Found X matches:`
- Verify `VECTARA_API_KEY` in `.env`
- Try broader search terms: "founders", "engineers", "sales"

### If markdown looks wrong:
- Check `<ChatMessage>` component is being used
- Should see proper lists, **bold**, *italic*
- No raw markdown symbols

### If agent doesn't use tool:
- User must explicitly ask to find/search
- Try: "find me X" or "search for Y"
- Check agent has maxSteps: 3 (allows tool usage)

---

## 📝 Scripts Reference

```bash
# Database
pnpm db:generate    # Generate migrations
pnpm db:push        # Push schema to DB
pnpm db:studio      # Open Drizzle Studio

# Vectara
pnpm reset:vectara  # Delete corpus
pnpm seed:vectara   # Seed all 424 profiles

# Development
pnpm dev            # Start dev server
pnpm build          # Production build
pnpm typecheck      # Check TypeScript

# Analysis
tsx scripts/analyze-schema.ts  # Inspect JSON structure
```

---

## 🎬 Demo Talking Points

1. **Problem**: 400+ people at hackathon, how to find the RIGHT connections?

2. **Solution**: SEED uses AI to:
   - Extract what you're looking for through conversation
   - Search semantically (not just keywords)
   - Simulate networking before you meet

3. **Tech Highlights**:
   - Google Gemini Flash Lite powers all 3 agents
   - Vectara RAG searches 424 profiles with full context
   - Mastra.ai orchestrates agents with memory
   - Working memory persists across conversations

4. **Unique Features**:
   - Uses company intelligence data (whitecontext)
   - AI-generated match reasoning
   - Conversation simulation for practice
   - Maps integration ready (SHACK15 suggestions)

---

## ✨ What Makes SEED Special

**Not just keyword matching** - Semantic understanding of expertise, goals, and challenges

**Rich context** - LinkedIn + company intelligence + AI summaries

**Interactive refinement** - Chat to narrow down exactly who you want

**Practice mode** - Simulate conversations before the real thing

**Built for hackathons** - Fast, focused, helps you make meaningful connections in limited time

---

**SEED is ready to present!** 🌱

The complete relationship-building platform for hackathon participants, powered by Google Gemini and RAG.
