# Pulse — Tasks

## How to use this file
Each task references one or more requirements from `requirements.md`.
Tasks are ordered by dependency — complete them in sequence.
Each task is atomic: it has a clear input, output, and definition of done.

---

## Phase 1 — Project Setup

- [x] TASK-001 — Initialize Next.js project
**Refs:** REQ-020, REQ-021
**Description:**
Create a new Next.js 14 project with App Router and TypeScript.
Install and configure all base dependencies.

**Dependencies to install:**
- `next`, `react`, `react-dom`
- `typescript`, `@types/react`, `@types/node`
- `tailwindcss`, `postcss`, `autoprefixer`
- `next-auth`
- `@google/generative-ai`
- `@vercel/kv`
- `@vercel/blob`

**Definition of done:**
- `npm run dev` runs without errors
- Tailwind working with a test class
- TypeScript strict mode enabled in `tsconfig.json`

---

- [x] TASK-002 — Define global TypeScript types
**Refs:** REQ-004, REQ-005, REQ-006, REQ-008
**File:** `types/index.ts`
**Description:**
Define all interfaces used across the project:
- `DailyBriefing`
- `BriefingContent`
- `PendingItem`
- `BlockerItem`
- `GitHubActivity`, `Commit`, `PullRequest`, `Issue`
- `GoogleActivity`, `CalendarEvent`
- `JiraActivity`, `JiraTicket`

**Definition of done:**
- All interfaces exported from `types/index.ts`
- No TypeScript errors

---

- [x] TASK-003 — Create Kiro steering docs
**Refs:** All
**Files:**
- `.kiro/steering/project.md`
- `.kiro/steering/voice.md`
- `.kiro/steering/data-sources.md`

**Description:**
Write the three steering documents that will guide Kiro
throughout the entire development process.

**`project.md` must include:**
- Project overview and purpose
- Tech stack and versions
- Folder structure conventions
- Rule: all external API calls go in `/lib/`, never in components
- Rule: no `any` types allowed

**`voice.md` must include:**
- gemini output must never contain bullet points (goes to TTS)
- Max 350 words per briefing
- Tone guidelines: professional, warm, second person
- ElevenLabs model to use: `eleven_turbo_v2`

**`data-sources.md` must include:**
- Every source function returns its type or `null` on error
- Always handle source failures gracefully
- OAuth tokens never exposed to client
- All fetches run in parallel with `Promise.allSettled`

**Definition of done:**
- Three files exist in `.kiro/steering/`
- Kiro acknowledges the steering context in responses

---

## Phase 2 — Authentication

- [x] TASK-004 — Configure NextAuth with GitHub OAuth
**Refs:** REQ-001, REQ-002, REQ-021
**Files:**
- `app/api/auth/[...nextauth]/route.ts`
- `.env.local`

**Description:**
Set up NextAuth.js with GitHub provider.
Store access token in the session for later use in API calls.

**Required env vars:**
```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
```

**Definition of done:**
- User can sign in with GitHub
- `session.accessToken` contains the GitHub token
- Token never appears in client-side code

---

- [x] TASK-005 — Add Google OAuth provider
**Refs:** REQ-001, REQ-002, REQ-021
**Files:**
- `app/api/auth/[...nextauth]/route.ts` (update)
- `.env.local` (update)

**Description:**
Extend NextAuth config to support Google provider.
Request scopes: `calendar.readonly`, `userinfo.email`.

**Required env vars:**
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

**Definition of done:**
- User can sign in with Google
- Google access token stored in session
- Calendar scope granted and visible in Google console

---

- [x] TASK-006 — Build onboarding flow UI
**Refs:** REQ-001, REQ-002, REQ-003
**Files:**
- `app/(auth)/login/page.tsx`
- `components/onboarding/OnboardingFlow.tsx`
- `components/onboarding/SourceCard.tsx`

**Description:**
Build the onboarding wizard that guides the user to connect
at least one data source before accessing the dashboard.

**SourceCard component must show:**
- Service name and logo
- Connection status (connected / not connected)
- Connect / disconnect button

**OnboardingFlow must:**
- Show GitHub and Google cards
- Require at least one connection to proceed
- Redirect to `/dashboard` on completion (REQ-003)

**Definition of done:**
- User can connect GitHub and/or Google
- Cannot proceed with zero connections
- Redirects correctly to dashboard

---

## Phase 3 — Data Sources

- [x] TASK-007 — GitHub data source client
**Refs:** REQ-004, REQ-007
**File:** `lib/sources/github.ts`

**Description:**
Implement `fetchGitHubActivity(token: string): Promise<GitHubActivity | null>`

**Must fetch from GitHub REST API:**
- Commits by the authenticated user in the last 24 hours
- Open PRs authored by the user
- PRs where the user has a pending review request
- Issues closed by the user in the last 24 hours
- PRs merged by the user in the last 24 hours

**Error handling:**
- On any fetch failure, log the error and return `null`
- Never throw — always return `null` on error

**Definition of done:**
- Function returns typed `GitHubActivity` object
- Returns `null` on network error or invalid token
- No raw `fetch` calls outside this file

---

- [x] TASK-008 — Google Calendar data source client
**Refs:** REQ-005, REQ-007
**File:** `lib/sources/google.ts`

**Description:**
Implement `fetchGoogleActivity(token: string): Promise<GoogleActivity | null>`

**Must fetch:**
- All calendar events for today (midnight to midnight, user's timezone)
- For each event: title, start time, end time, attendees count

**Compute:**
- `totalMeetingMinutes`: sum of all event durations in minutes

**Error handling:**
- Return `null` on any failure

**Definition of done:**
- Returns today's events sorted by start time
- `totalMeetingMinutes` correctly computed
- Returns `null` on error

---

- [x] TASK-009 — Jira data source client
**Refs:** REQ-006, REQ-007
**File:** `lib/sources/jira.ts`

**Description:**
Implement `fetchJiraActivity(token: string, domain: string): Promise<JiraActivity | null>`

**Must fetch via Jira REST API v3:**
- Tickets assigned to the user with status "In Progress"
- Tickets moved by the user in the last 24 hours
- Tickets flagged as blockers in the current sprint
- Current sprint name

**Note for MVP:**
If Jira is not connected, this function is never called.
The briefing generates normally without Jira data.

**Definition of done:**
- Returns typed `JiraActivity` or `null`
- Handles missing sprint gracefully
- Works with Jira Cloud domains

---

## Phase 4 — AI & Voice Pipeline

- [x] TASK-010 — Gemini synthesis prompt
**Refs:** REQ-008, REQ-009
**File:** `lib/ai/prompts.ts`

**Description:**
Define and export the main briefing prompt as a function:

```typescript
export function buildBriefingPrompt(data: {
  github: GitHubActivity | null
  google: GoogleActivity | null
  jira: JiraActivity | null
}): string
```

**The prompt must instruct gemini to:**
- Return ONLY valid JSON matching `BriefingContent`
- Open with a 1-sentence energy-setting summary
- Flag blockers before pending items
- Use second person ("you merged", "your PR")
- Stay under 350 words total
- Never use bullet points (output goes to TTS)
- List today's meetings in chronological order

**Definition of done:**
- Function returns a complete, tested prompt string
- Prompt explicitly requests JSON output
- Prompt handles the case where a source is null

---

- [x] TASK-011 — Gemini API integration
**Refs:** REQ-008, REQ-009
**File:** `lib/ai/synthesize.ts`

**Description:**
Implement `synthesizeBriefing(data): Promise<BriefingContent>`

**Must:**
- Call gemini API using `@google/generative-ai`
- Use model: `gemini-2.5-flash`
- Parse the JSON response safely
- Validate the response matches `BriefingContent`
- Throw a descriptive error if parsing fails

**Definition of done:**
- Returns valid `BriefingContent` from real gemini API call
- Handles malformed JSON response with a clear error
- API key read from `GOOGLE_API_KEY` env var

---

- [x] TASK-012 — ElevenLabs TTS integration
**Refs:** REQ-010, REQ-011
**File:** `lib/voice/tts.ts`

**Description:**
Implement `generateAudio(text: string): Promise<string>`
Returns a public URL to the generated MP3 file.

**Must:**
- Call ElevenLabs TTS API with `eleven_turbo_v2` model
- Use the configured "Pulse" voice ID from env var
- Save the MP3 to Vercel Blob
- Return the public Blob URL

**Required env vars:**
```
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
```

**Definition of done:**
- Returns a valid, publicly accessible MP3 URL
- Audio is saved to Vercel Blob
- Voice is consistent across calls (same voice ID)

---

- [x] TASK-013 — Briefing cache layer
**Refs:** REQ-018, REQ-019
**File:** `lib/cache/briefing.ts`

**Description:**
Implement two functions using Vercel KV:

```typescript
export async function getCachedBriefing(
  userId: string,
  date: string
): Promise<DailyBriefing | null>

export async function cacheBriefing(
  briefing: DailyBriefing
): Promise<void>
```

**Cache key format:** `briefing:{userId}:{YYYY-MM-DD}`
**TTL:** 24 hours

**Definition of done:**
- Briefing is retrievable by userId + date
- Expired briefings return null
- KV connection uses `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars

---

## Phase 5 — API Routes

- [x] TASK-014 — POST /api/briefing/generate
**Refs:** REQ-004, REQ-005, REQ-006, REQ-007, REQ-008,
         REQ-009, REQ-010, REQ-018, REQ-019
**File:** `app/api/briefing/generate/route.ts`

**Description:**
Orchestrates the full briefing pipeline:

```
1. Authenticate request (valid session required)
2. Check cache — return existing briefing if found
3. Fetch all sources in parallel with Promise.allSettled
4. Call synthesizeBriefing with aggregated data
5. Call generateAudio with briefing text
6. Build DailyBriefing object with status 'ready'
7. Cache the briefing
8. Return briefing as JSON
```

**Error handling:**
- If gemini fails → return 500 with error message
- If ElevenLabs fails → return 500 with error message
- If a data source fails → continue with null for that source

**Definition of done:**
- Returns complete `DailyBriefing` with audioUrl
- Cached result returned on second call (no reprocessing)
- All source failures handled gracefully

---

- [x] TASK-015 — GET /api/briefing/status
**Refs:** REQ-018
**File:** `app/api/briefing/status/route.ts`

**Description:**
Returns the briefing for today if it exists in cache.

**Response:**
- If found: `{ status: 'ready', briefing: DailyBriefing }`
- If not found: `{ status: 'pending' }`

**Definition of done:**
- Returns cached briefing instantly
- Returns pending status when no briefing exists

---

- [x] TASK-016 — POST /api/assistant/session
**Refs:** REQ-014, REQ-015, REQ-016
**File:** `app/api/assistant/session/route.ts`

**Description:**
Creates an ElevenLabs Conversational AI session
pre-loaded with today's briefing as context.

**Must:**
- Read today's briefing from cache
- Build a system prompt including the full briefing content
- Initialize ElevenLabs Conversational AI session
- Return the session token/URL to the client

**System prompt for the agent:**
```
You are Pulse, a work assistant. You have full knowledge
of the user's work activity today. Here is their briefing:
{BRIEFING_CONTENT}

Answer questions about their PRs, tickets, and meetings.
Be concise. Speak in second person.
```

**Definition of done:**
- Returns a valid ElevenLabs session identifier
- Agent answers questions about the user's actual data
- Session expires after 5 minutes of inactivity

---

## Phase 6 — UI

- [x] TASK-017 — Dashboard page layout
**Refs:** REQ-003, REQ-012, REQ-013
**File:** `app/dashboard/page.tsx`

**Description:**
Build the main dashboard page with three zones:
1. **Header:** Pulse logo, date, connected sources status
2. **Player zone:** BriefingPlayer component (center)
3. **Assistant zone:** AssistantButton (bottom)

**On load:**
- Call `GET /api/briefing/status`
- If `pending`: show "Generating your briefing..." state
  and call `POST /api/briefing/generate`
- If `ready`: render player immediately

**Definition of done:**
- Page loads and fetches briefing automatically
- Loading state shown during generation
- All three zones render correctly

---

- [x] TASK-018 — BriefingPlayer component
**Refs:** REQ-012, REQ-013
**File:** `components/dashboard/BriefingPlayer.tsx`

**Props:** `{ audioUrl: string, transcript: string }`

**Must include:**
- Play / pause button
- Progress bar with current time and total duration
- Speed selector: 1x, 1.5x, 2x
- Transcript toggle button
- When transcript is open: full text displayed below player

**Definition of done:**
- Audio plays from ElevenLabs URL
- Speed control works correctly
- Transcript toggles without layout shift

---

- [x] TASK-019 — SourceStatus component
**Refs:** REQ-007
**File:** `components/dashboard/SourceStatus.tsx`

**Props:** `{ sources: DailyBriefing['sources'] }`

**Must show:**
- Icon + name for each source (GitHub, Google, Jira)
- Green dot if data was fetched successfully
- Yellow dot if source returned null
- Tooltip on hover explaining the status

**Definition of done:**
- Correctly reflects which sources contributed to briefing
- Visually clear at a glance

---

- [x] TASK-020 — AssistantButton and voice session UI
**Refs:** REQ-014, REQ-015, REQ-016
**File:** `components/dashboard/AssistantButton.tsx`

**Description:**
Button that activates the ElevenLabs Conversational AI session.

**States:**
- `idle`: "Ask Pulse" button
- `connecting`: spinner while session initializes
- `active`: pulsing indicator, "Listening..." label, stop button
- `summary`: after session ends, shows Q&A summary text

**On click:**
- Call `POST /api/assistant/session`
- Initialize ElevenLabs client-side SDK with returned session
- Handle mic permissions gracefully

**Definition of done:**
- Voice session starts and user can speak
- Agent responds with voice about their actual data
- Q&A summary shown after session ends (REQ-016)

---

## Phase 7 — Polish & Demo Prep

- [x] TASK-021 — Mobile responsive layout
**Refs:** REQ-022
**Description:**
Audit and fix all components for mobile browsers.
Touch targets minimum 44x44px.
Player controls stack vertically on small screens.

**Definition of done:**
- App fully usable on iPhone Safari and Android Chrome
- No horizontal scroll on any screen size

---

- [x] TASK-022 — Mock data mode for demo
**Refs:** REQ-007
**Description:**
Add a `DEMO_MODE=true` env var that bypasses real OAuth
and uses hardcoded mock data for GitHub, Google, and Jira.

**Purpose:** Allow judges to test the full experience
without needing to connect real accounts.

**Mock data must include:**
- 3 commits, 2 open PRs, 1 pending review
- 4 calendar events including a "Daily Standup" at 9am
- 2 Jira tickets in progress, 1 blocker

**Definition of done:**
- `DEMO_MODE=true` skips OAuth and uses mock data
- Full briefing generates and plays with mock data
- No real credentials required to experience the product

---

- [x] TASK-023 — Error boundary and fallback states
**Refs:** REQ-007, REQ-019
**Description:**
Add React error boundaries around player and assistant.
Show friendly error messages when generation fails.

**Definition of done:**
- App never shows raw error stack to user
- Clear message shown when briefing generation fails
- Retry button available on error state

---

## Environment Variables Summary

```
# Auth
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
GOOGLE_API_KEY=

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
