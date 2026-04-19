# Pulse — Project Steering v2
 
## What is Pulse
Pulse is a voice-first team intelligence tool that aggregates work activity
from GitHub, Google Calendar, and Jira across all team members to:
1. Generate a personalized daily audio briefing for each user
2. Detect overlapping work, shared repos, and potential conflicts across the team
3. Allow any team member to ask an AI voice assistant about what others are working on
The goal is to eliminate unnecessary interruptions, duplicate work, and merge
conflicts — without requiring anyone to write a single status update.
 
---
 
## Tech Stack
- **Framework:** Next.js 14 with App Router
- **Language:** TypeScript (strict mode, no `any` allowed)
- **Styling:** Tailwind CSS (utility classes only, no custom CSS files)
- **Auth:** NextAuth.js v5
- **AI:** Google Generative AI SDK (`@google/generative-ai`) — model: `gemini-2.5-flash`
- **Voice:** ElevenLabs TTS + Conversational AI
- **Storage:** Vercel KV (cache, team data) + Vercel Blob (audio MP3 files)
- **Deployment:** Vercel
---
 
## AI Integration — Gemini
 
The project uses the official Google Generative AI SDK. Never use fetch
directly to call Gemini — always use the SDK client.
 
### SDK initialization
Always initialize the client once per module, reading the key from env:
 
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai'
 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
```
 
### Calling the model
```typescript
const result = await model.generateContent(prompt)
const text = result.response.text()
```
 
### JSON responses
When expecting structured JSON output, always:
1. Include `Return ONLY valid JSON, no markdown, no backticks` in the prompt
2. Wrap the parse in try/catch
3. Never assume the response is clean — strip backtick fences before parsing:
```typescript
const raw = result.response.text()
const clean = raw.replace(/```json|```/g, '').trim()
const parsed = JSON.parse(clean)
```
 
### Model to use
Always use `gemini-2.5-flash` — never hardcode a different model string.
Read nothing from env for the model name — it is always `gemini-2.5-flash`.
 
---
 
## Folder Conventions
 
### The golden rule
All calls to external APIs (GitHub, Google Calendar, Jira, Gemini, ElevenLabs)
MUST live in `/lib/`. Never call external APIs directly from components
or API routes. API routes call lib functions. Components call API routes.
 
```
Component → API Route → lib function → External API
```
 
### Where things go
- `/lib/sources/` — Data fetching from GitHub, Google Calendar, Jira
- `/lib/team/` — Team activity aggregation and overlap detection
- `/lib/ai/` — Gemini prompt building and API calls
- `/lib/voice/` — ElevenLabs TTS and Conversational AI
- `/lib/cache/` — Vercel KV read/write (personal briefings and team data)
- `/lib/mock/` — Mock data for DEMO_MODE
- `/components/` — React components, no API calls here
- `/app/api/` — Next.js API routes, thin orchestration layer only
- `/types/index.ts` — All TypeScript interfaces, single source of truth
---
 
## Code Conventions
 
### TypeScript
- Strict mode is enabled — never use `any`
- All functions must have explicit return types
- All async functions return a typed Promise
- Use `interface` for object shapes, `type` for unions/aliases
### Error handling
- Functions in `/lib/sources/` NEVER throw — they return `null` on error
- Functions in `/lib/team/` NEVER throw — they return empty arrays or null on error
- Functions in `/lib/ai/` may throw with descriptive messages
- Functions in `/lib/voice/` may throw with descriptive messages
- API routes always return typed JSON responses
- Never expose raw error messages to the client
### Naming
- Components: PascalCase (`BriefingPlayer.tsx`)
- Lib functions: camelCase (`fetchGitHubActivity`)
- API routes: kebab-case folders (`/api/briefing/generate`)
- Types/interfaces: PascalCase (`DailyBriefing`, `TeamMember`)
- Constants: SCREAMING_SNAKE_CASE (`ELEVENLABS_MODEL`)
### Environment variables
- All env vars defined in `.env.local`
- Server-only vars never prefixed with `NEXT_PUBLIC_`
- Always read env vars at the top of the file, never inline
- If a required env var is missing, throw a descriptive error on startup
---
 
## Data Models — Key Interfaces
 
The full definitions live in `/types/index.ts`. Summary for Kiro:
 
- `Team` — id, name, memberIds, inviteToken, inviteExpiresAt
- `TeamMember` — userId, teamId, name, avatarUrl, timezone, connections
- `MemberActivity` — userId, date, github, google, jira, focusSummary, touchedRepos, touchedPaths, touchedEpics
- `Overlap` — id, type (conflict/synergy/awareness), memberIds, reason, detail, repos, paths
- `DailyBriefing` — userId, date, status, content, audioUrl, relevantOverlaps
- `BriefingContent` — summary, achievements, pending, blockers, todaySchedule, teamAlerts
---
 
## Authentication Rules
- OAuth tokens stored server-side in NextAuth session only
- Tokens never returned to the client or logged
- All `/api/` routes check for valid session before proceeding
- Use `getServerSession()` in API routes, never client-side session hooks
---
 
## Team Data Rules
- Team activity is aggregated every 60 minutes via Vercel cron
- Each member's activity is stored individually in KV, never merged
- Overlaps are computed after all member activity is refreshed
- Team data is strictly scoped — no cross-team data access ever
- Members see only `focusSummary` of teammates in the UI, never raw commits or file paths
---
 
## State Management
- No external state library (no Redux, no Zustand)
- Server state: fetched via API routes
- Client state: React `useState` and `useReducer` only
- No localStorage or sessionStorage
---
 
## Demo Mode
When `DEMO_MODE=true` env var is set:
- Skip all OAuth flows
- Use mock data from `/lib/mock/data.ts` for all sources AND team members
- All lib/sources and lib/team functions return mock data
- Pre-loaded with 4 team members, realistic overlaps (1 conflict, 1 synergy, 1 awareness)
- This mode is for judge demos only — never enabled in production
---
 
## Environment Variables
 
```
# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
 
# AI
GEMINI_API_KEY=
 
# Voice
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
 
# Storage
KV_REST_API_URL=
KV_REST_API_TOKEN=
BLOB_READ_WRITE_TOKEN=
 
# Demo
DEMO_MODE=false
```