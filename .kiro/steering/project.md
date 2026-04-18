# Pulse — Project Steering

## What is Pulse
Pulse is a voice-first daily briefing web app that aggregates
work activity from GitHub, Google Calendar, and Jira, then
generates a personalized 2-3 minute audio summary each morning.
It replaces synchronous daily standups with an async, voice-native experience.

## Tech Stack
- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript (strict mode, no `any` allowed)
- **Styling:** Tailwind CSS (utility classes only, no custom CSS files)
- **Auth:** NextAuth.js v5
- **AI:** Gemini SDK (`@google/generative-ai`) — model: `gemini-2.5-flash`
- **Voice:** ElevenLabs TTS + Conversational AI
- **Storage:** Vercel KV (cache) + Vercel Blob (audio files)
- **Deployment:** Vercel

## Folder Conventions

### The golden rule
All calls to external APIs (GitHub, Google, Jira, Gemini, ElevenLabs)
MUST live in `/lib/`. Never call external APIs directly from components
or API routes. API routes call lib functions. Components call API routes.

```
Component → API Route → lib function → External API
```

### Where things go
- `/lib/sources/` — Data fetching from GitHub, Google, Jira
- `/lib/ai/` — Gemini prompt building and API calls
- `/lib/voice/` — ElevenLabs TTS and Conversational AI
- `/lib/cache/` — Vercel KV read/write
- `/components/` — React components, no API calls here
- `/app/api/` — Next.js API routes, thin orchestration layer only
- `/types/index.ts` — All TypeScript interfaces, single source of truth

## Code Conventions

### TypeScript
- Strict mode is enabled — never use `any`
- All functions must have explicit return types
- All async functions return a typed Promise
- Use `interface` for object shapes, `type` for unions/aliases

### Error handling
- Functions in `/lib/sources/` NEVER throw — they return `null` on error
- Functions in `/lib/ai/` and `/lib/voice/` may throw with descriptive messages
- API routes always return typed JSON responses
- Never expose raw error messages to the client

### Naming
- Components: PascalCase (`BriefingPlayer.tsx`)
- Lib functions: camelCase (`fetchGitHubActivity`)
- API routes: kebab-case folders (`/api/briefing/generate`)
- Types/interfaces: PascalCase (`DailyBriefing`, `BriefingContent`)
- Constants: SCREAMING_SNAKE_CASE (`ELEVENLABS_MODEL`)

### Environment variables
- All env vars are defined in `.env.local`
- Server-only vars (API keys) are never prefixed with `NEXT_PUBLIC_`
- Always read env vars at the top of the file, never inline
- If an env var is missing, throw a descriptive error on startup

## Authentication Rules
- OAuth tokens are stored server-side in the NextAuth session
- Tokens are never returned to the client or logged
- All `/api/` routes check for a valid session before proceeding
- Use `getServerSession()` in API routes, never client-side session hooks

## State Management
- No external state library (no Redux, no Zustand)
- Server state: fetched via API routes
- Client state: React `useState` and `useReducer` only
- No localStorage or sessionStorage usage

## Demo Mode
When `DEMO_MODE=true` env var is set:
- Skip all OAuth flows
- Use mock data from `/lib/mock/data.ts`
- All lib/sources functions return mock data instead of real API calls
- This mode is for judge demos only — never enabled in production