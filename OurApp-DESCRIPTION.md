So, for the hackathon we thought of `This app is meant to help humans establish new relationships.`

We have conflict of desires and here is what we need to combine into single app:

- networking for founders,
- "I'm looking for a man in finance. Trust fund, 6'5", blue eyes" dating,
- `i want to get recommendation for internship`
- "I want a great job for ML research"

This app is meant to help humans establish new relationships.

we must use google gemini multimodality.
multimodality can be used to let users (hackathon participants) express their desires and needs and challenges and problems and hobbies and (indroduce themselves).
with gemini we can use video and voice and use camera and microphone and text input to help agent understand who to recommend to contact.

a) entire dataset with whitecontext is like 1,5M context = too much to fit into single context window.
b) we should recommend 3 participants for every hackathon participant
c) an agent should be able to narrow down the search by asking specific questions that will help the app user get specific.

here are some questions we thought of few hours ago:

```
1.	What is your name?
2.	How old are you?
3.	Where do you live?
4.	Provide your email address so we can communicate with you.
5.	What activities do you enjoy with your best friends?
6.	What gives you a sense of fulfillment?
7.	We are here to create long-term relationships. What would you expect from such a relationship?
```
as well as system prompt ideas like:

```
You are SEED.
Your job in general is to help `Plant a longterm relationship.`
User is currently onboarding to our app.
Our app helps user the best when user provides following information about current state.

```ts
Questions = [
    "0. ⁠⁠Where do you live?",
    "1. Who are you searching for? Give me a short sentence such as I'm looking for  man in finance. Trust fund, 6'5\", blue eyes",
    "2. What is the biggest priority in your life and who could help you with that?",
    "3. What do you like to do for fun?",
]
```

You ask one question at a time.

```

or agent flows:

Conversation starts with agent asking initial question:

`What is the biggest priority in your life and who could help you with that?`

user replies.

Agent use /search-people tool, gets the most relevant profiles and generates the response that includes follow-up questions to refine the search

`⁠In which direction would you like to evolve?`

user replies.

Agent use /search-people tool, gets the most relevant profiles and generates the response that includes follow-up questions to refine the search

---
with each agent response user should see top 3/6/9 cards with profiles, tldr and `Simulate conversation` button

```

i'm currently thinking of using some RAG? like with VECTATA-SDK.md so we can seed the database and let the MASTRA (mastra.ai) agent use the Vectara as tool.
The vectara tool should search for profiles that are relevant.

how can we design that properly?

we have drizzle-orm and pg database ready - we can use it with the mastra agent.
we can use the vectara for RAG.
we can use gemini flash 2.5 for multimodality and agent chat.

see a_context/mastra_examples to see how to build the src/mastra and design that agent.

we are thinking about 2 stage app:
a) user and agent Q&A => mini-app that results in multimodal context translated to text only.
b) then based on user context we can have the search people mini-app that use vectara rag to help the user assess the search and present top3 results based on user input,user desires/problems, user context. the app should let the user select user and simulate networking session that will be full of personalized icebreakers
c) networking simulator - based on a), b) summary and user and other guest contexts provide inspirations on how to schedule meeting after the hackathon.

most of guests are not familiar with the closest places - let's help users by using maps tool additionally to find something close to SHACK15 in SF - ofc based on users preferences!

snippet on how to use gemini maps:

Get started
This example demonstrates how to integrate Grounding with Google Maps into your application to provide accurate, location-aware responses to user queries. The prompt asks for local recommendations with an optional user location, enabling the Gemini model to leverage Google Maps data.

Python
JavaScript
REST

import { GoogleGenAI } from "@google/gnai";

const ai = new GoogleGenAI({});

async function generateContentWithMapsGrounding() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "What are the best Italian restaurants within a 15-minute walk from here?",
    config: {
      // Turn on grounding with Google Maps
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          // Optionally provide the relevant location context (this is in Los Angeles)
          latLng: {
            latitude: 34.050481,
            longitude: -118.248526,
          },
        },
      },
    },
  });

  console.log("Generated Response:");
  console.log(response.text);

  const grounding = response.candidates[0]?.groundingMetadata;
  if (grounding?.groundingChunks) {
    console.log("-".repeat(40));
    console.log("Sources:");
    for (const chunk of grounding.groundingChunks) {
      if (chunk.maps) {
        console.log(`- [${chunk.maps.title}](${chunk.maps.uri})`);
      }
    }
  }
}

generateContentWithMapsGrounding();
How Grounding with Google Maps works
Grounding with Google Maps integrates the Gemini API with the Google Geo ecosystem by using the Maps API as a grounding source. When a user's query contains geographical context, the Gemini model can invoke the Grounding with Google Maps tool. The model can then generate responses grounded in Google Maps data relevant to the provided location.

The process typically involves:

User query: A user submits a query to your application, potentially including geographical context (e.g., "coffee shops near me," "museums in San Francisco").
Tool invocation: The Gemini model, recognizing the geographical intent, invokes the Grounding with Google Maps tool. This tool can optionally be provided with the user's latitude and longitude for location-aware results.
Data retrieval: The Grounding with Google Maps service queries Google Maps for relevant information (e.g., places, reviews, photos, addresses, opening hours).
Grounded generation: The retrieved Maps data is used to inform the Gemini model's response, ensuring factual accuracy and relevance.
Response & widget token: The model returns a text response, which includes citations to Google Maps sources. Optionally, the API response may also contain a google_maps_widget_context_token, allowing developers to render a contextual Google Maps widget in their application for visual interaction.
Why and when to use Grounding with Google Maps
Grounding with Google Maps is ideal for applications that require accurate, up-to-date, and location-specific information. It enhances the user experience by providing relevant and personalized content backed by Google Maps' extensive database of over 250 million places worldwide.

You should use Grounding with Google Maps when your application needs to:

Provide complete and accurate responses to geo-specific questions.
Build conversational trip planners and local guides.
Recommend points of interest based on location and user preferences like restaurants or shops.
Create location-aware experiences for social, retail, or food delivery services.
Grounding with Google Maps excels in use cases where proximity and current factual data are critical, such as finding the "best coffee shop near me" or getting directions.

---
how to solve that?
maybe we should process this context properly, plan how to implement that in somehting like 20 steps and test and iterate?
let's track all the progress inside markdown file and translate this OurApp-DESCRIPTION.md into markdown todo.md with checked boxes. let the todo.md be the documentation too. Don't repeat yourself but use that as future reference so future agents can understand our thought process easily by just reading the todo.md

maybe think of the schema.ts and postgresql part too? maybe we should store some data about the conversations and let users reuse them? let's keep all the chats/conversations public and just save new. maybe we can use some search there too?

think of shadcn components. use following shadcn blue theme:

:root {
  --radius: 0.65rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.141 0.005 285.823);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.623 0.214 259.815);
  --primary-foreground: oklch(0.97 0.014 254.604);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.967 0.001 286.375);
  --muted-foreground: oklch(0.552 0.016 285.938);
  --accent: oklch(0.967 0.001 286.375);
  --accent-foreground: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.92 0.004 286.32);
  --input: oklch(0.92 0.004 286.32);
  --ring: oklch(0.623 0.214 259.815);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.141 0.005 285.823);
  --sidebar-primary: oklch(0.623 0.214 259.815);
  --sidebar-primary-foreground: oklch(0.97 0.014 254.604);
  --sidebar-accent: oklch(0.967 0.001 286.375);
  --sidebar-accent-foreground: oklch(0.21 0.006 285.885);
  --sidebar-border: oklch(0.92 0.004 286.32);
  --sidebar-ring: oklch(0.623 0.214 259.815);
}

.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.21 0.006 285.885);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.21 0.006 285.885);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.546 0.245 262.881);
  --primary-foreground: oklch(0.379 0.146 265.522);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.274 0.006 286.033);
  --muted-foreground: oklch(0.705 0.015 286.067);
  --accent: oklch(0.274 0.006 286.033);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.488 0.243 264.376);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.21 0.006 285.885);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.546 0.245 262.881);
  --sidebar-primary-foreground: oklch(0.379 0.146 265.522);
  --sidebar-accent: oklch(0.274 0.006 286.033);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.488 0.243 264.376);
}
