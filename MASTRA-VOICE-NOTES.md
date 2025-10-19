# Mastra Voice Integration - Technical Notes

## Summary
Attempted to integrate Mastra's `GeminiLiveVoice` abstraction for voice onboarding but encountered limitations with bidirectional conversation flow.

## What Works ✅
- **Existing Implementation** (`/api/voice/live`): Uses direct `@google/genai` SDK - fully functional bidirectional voice conversations
- **Mastra Text Agents**: All text-based agents (onboarding, search, networking simulator) work perfectly
- **Mastra Memory**: Resource-scoped memory persists across conversations
- **Mastra Tools**: Search and Maps tools integrated successfully

## Mastra Voice Integration Attempt

### Files Created
1. `src/mastra/agents/voice-onboarding-agent.ts` - Voice-optimized agent definition
2. `src/app/api/voice/mastra-live/route.ts` - API route using `@mastra/voice-google-gemini-live`
3. `src/app/onboard-mastra-voice/page.tsx` - Frontend React component

### What Worked
- ✅ Connection establishment
- ✅ System instructions configuration
- ✅ Audio output (agent speaking)
- ✅ Audio input (microphone capture)
- ✅ Event system (speaker, writing, turnComplete)

### What Didn't Work
- ❌ **Continuous conversation flow**: Agent speaks once, then stops
- ❌ **Automatic response triggering**: After user speaks, agent doesn't respond
- ❌ **Bidirectional streaming**: The `send(audioInputStream)` pattern doesn't trigger voice activity detection

## Technical Analysis

### Issue: One-Turn Limitation
```typescript
// This pattern works for ONE turn:
voice.speak("Hi! What's your name?");
// → Agent speaks
// → Turn completes
// → User speaks (audio sent via POST)
// → ❌ No automatic response from agent
```

### Root Cause
Mastra's `GeminiLiveVoice.send()` method accepts a stream but doesn't seem to:
1. Enable automatic voice activity detection
2. Trigger agent responses when user speech is detected
3. Create a true bidirectional conversation loop

### Working Pattern (Direct SDK)
```typescript
// Using @google/genai directly:
const session = await ai.live.connect({...});

// Send user audio
session.send({
  realtimeInput: {
    mediaChunks: [{ data: base64Audio, mimeType: "audio/pcm;rate=16000" }],
  },
});

// Agent automatically responds via WebSocket callbacks
callbacks.onmessage = (message) => {
  // Audio and text responses arrive here automatically
};
```

## Recommendation

**For the hackathon, use the working implementation** (`/api/voice/live`):
- Fully bidirectional voice conversations
- Proven to work reliably
- Direct Google GenAI SDK integration
- Homepage now features it as "Recommended"

## Future: Mastra Integration

If Mastra adds better support for bidirectional voice conversations, the infrastructure is in place:
- Voice agent is defined and registered
- Frontend component is built
- API route structure exists

### Potential Solutions
1. **Mastra team adds voice conversation mode** to `GeminiLiveVoice`
2. **Use Mastra Agent with custom voice handling**: Keep using direct SDK for voice I/O, but integrate with Mastra agents for conversation logic
3. **Hybrid approach**: Use `@google/genai` for streaming, but call `agent.generate()` for text responses

## Lessons Learned

1. **Abstractions have limits**: Mastra's voice abstraction is great for TTS/STT, but not ready for real-time bidirectional conversations
2. **Direct SDK sometimes better**: For cutting-edge features like Gemini Live, direct integration may be more reliable
3. **Pragmatism wins**: Use what works for the hackathon, iterate later

## File Cleanup

Optional: Remove these files if not using Mastra voice:
- `src/mastra/agents/voice-onboarding-agent.ts`
- `src/app/api/voice/mastra-live/route.ts`
- `src/app/onboard-mastra-voice/page.tsx`

Or keep them for future experimentation!
