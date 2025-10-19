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