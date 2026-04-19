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
         REQ-009, REQ-018, REQ-019
**File:** `app/api/briefing/generate/route.ts`

**Description:**
Orchestrates the briefing text pipeline (audio is generated on-demand via TASK-044):

```
1. Authenticate request (valid session required)
2. Check cache — return existing briefing if found
3. Fetch user's MemberActivity from KV (teamId lookup)
4. Fetch team Overlap[] from KV, filter to this user
5. Convert relevant Overlaps to TeamAlert[] for the prompt
6. Fetch all sources in parallel with Promise.allSettled
7. Call synthesizeBriefing with aggregated data + TeamAlert[]
8. Build DailyBriefing object with audioUrl: null
9. Cache the briefing
10. Return briefing as JSON
```

**Error handling:**
- If Gemini fails → return 500 with error message
- If a data source fails → continue with null for that source

**Definition of done:**
- Returns complete `DailyBriefing` with `audioUrl: null`
- Cached result returned on second call (no reprocessing)
- All source failures handled gracefully
- Audio generation is NOT triggered here (see TASK-044)

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
Main dashboard page with header nav, briefing player zone, assistant zone, stats, and team overlaps.

**On load:**
- Call `GET /api/briefing/status`
- If `ready` with cached `audioUrl`: restore player immediately
- If `ready` without `audioUrl`: show briefing text + "Generate audio briefing" button
- If `pending`: show generating animation (3 steps: GitHub → Calendar → Gemini), then call `POST /api/briefing/generate`

**Generating animation steps (text only — no audio):**
1. GitHub — Fetching commits, PRs, and reviews
2. Google Calendar — Loading today's schedule
3. Synthesizing with Gemini — Writing your briefing script

**Audio generation (on-demand):**
- After text briefing loads, the player slot shows the briefing summary text and a "Generate audio briefing" button
- Clicking the button calls `POST /api/briefing/audio` (TASK-044)
- While generating: spinner with "Generating audio with ElevenLabs..." label
- On success: swap in the full `BriefingPlayer` component
- On error: show error message and "Retry audio generation" button

**Header:**
- Pulse logo (dot + wordmark)
- Nav tabs: "My briefing" (active) / "Team" linking to `/dashboard/team`
- User avatar with initials

**Right column:**
- Ask Pulse card with `AssistantButton`
- Today at a glance card: Meetings, Open PRs, Team conflicts, Synergies, Merged yesterday

**Below grid:**
- Team overlaps section (only shown when `relevantOverlaps.length > 0`)
- Each overlap rendered as an inline colored card (conflict = red, synergy = green, awareness = neutral)

**Definition of done:**
- Page loads without triggering any AI or ElevenLabs API calls
- Briefing text renders immediately after Gemini step completes
- Audio generation is explicitly user-triggered
- Error state shown if generation fails, with a retry button
- Cached audio URL restored on page reload without re-generating

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

## Phase 8 — Team Data Models

- [x] TASK-024 — Add team TypeScript types
**Refs:** REQ-003, REQ-004, REQ-006, REQ-007
**File:** `types/index.ts`
**Description:**
Extend `types/index.ts` with all new team-related interfaces:
- `Team`
- `TeamMember`
- `MemberActivity`
- `Overlap`
- `TeamAlert`

Update `DailyBriefing` to include `relevantOverlaps: Overlap[]`.
Update `BriefingContent` to include `teamAlerts: TeamAlert[]`.
Update `GitHubActivity` to include `modifiedFiles: string[]`.

**Definition of done:**
- All new interfaces exported from `types/index.ts`
- Existing interfaces updated without breaking changes
- No TypeScript errors across the project

---

## Phase 9 — Team Management

- [x] TASK-025 — POST /api/team/create
**Refs:** REQ-003
**File:** `app/api/team/create/route.ts`
**Description:**
Create a new Team in Vercel KV.

**Must:**
- Require a valid session
- Accept `{ name: string }` in the request body
- Generate a unique `teamId` (UUID)
- Generate a unique `inviteToken`
- Set `inviteExpiresAt` to 72 hours from now
- Store the Team object under key `team:{teamId}`
- Add the creating user as the first member in `memberIds`
- Return the created Team including the invite link

**Definition of done:**
- Team is persisted in KV and retrievable by ID
- Invite token is unique and expires correctly
- Creating user is included as first member

---

- [x] TASK-026 — POST /api/team/join
**Refs:** REQ-003
**File:** `app/api/team/join/route.ts`
**Description:**
Allow a user to join a team via invite link.

**Must:**
- Accept `{ inviteToken: string }` in the request body
- Look up the Team by `inviteToken`
- Reject if token is expired or not found (return 400)
- Reject if team already has 25 members (return 400)
- Add the joining user to `memberIds`
- Update the Team record in KV
- Return the Team object

**Definition of done:**
- User is added to the team on valid token
- Expired tokens are rejected with a clear error
- Team size limit of 25 is enforced

---

- [x] TASK-027 — Onboarding team step
**Refs:** REQ-003
**Files:**
- `app/onboarding/team/page.tsx`
- `app/onboarding/sources/page.tsx`

**Description:**
Add a team step to the onboarding flow that appears after the user connects their data sources.

**Team step must:**
- Offer two options: "Create a team" and "Join a team"
- Create flow: text input for team name, calls `POST /api/team/create`, displays the generated invite link
- Join flow: text input for invite link/token, calls `POST /api/team/join`
- On success: redirect to `/dashboard`

**Definition of done:**
- User cannot reach the dashboard without completing the team step
- Both create and join paths work end-to-end
- Invite link is displayed clearly and copyable after team creation

---

## Phase 10 — Team Activity Aggregation

- [x] TASK-028 — Team activity cache layer
**Refs:** REQ-006
**File:** `lib/cache/team.ts`
**Description:**
Implement KV read/write functions for team activity data:

```typescript
export async function getMemberActivity(
  teamId: string,
  userId: string,
  date: string
): Promise<MemberActivity | null>

export async function cacheMemberActivity(
  teamId: string,
  activity: MemberActivity
): Promise<void>

export async function getAllMemberActivity(
  teamId: string,
  date: string
): Promise<MemberActivity[]>

export async function getCachedOverlaps(
  teamId: string,
  date: string
): Promise<Overlap[] | null>

export async function cacheOverlaps(
  teamId: string,
  date: string,
  overlaps: Overlap[]
): Promise<void>
```

**Cache key formats:**
- `activity:{teamId}:{userId}:{YYYY-MM-DD}` — TTL 24 hours
- `overlaps:{teamId}:{YYYY-MM-DD}` — TTL 24 hours

**Definition of done:**
- All functions implemented and typed
- TTL applied correctly on write
- `getAllMemberActivity` returns only records for the given team and date

---

- [x] TASK-029 — lib/team/aggregate.ts
**Refs:** REQ-006
**File:** `lib/team/aggregate.ts`
**Description:**
Implement `aggregateTeamActivity(teamId: string, date: string): Promise<MemberActivity[]>`

**Must:**
- Load all TeamMember records for the team from KV
- Fetch each member's GitHub, Google, and Jira activity in parallel using `Promise.allSettled`
- For each member, derive `touchedRepos`, `touchedPaths`, and `touchedEpics` from raw activity
- Call Gemini to generate a `focusSummary` string for each member (1 sentence)
- Store each `MemberActivity` in KV via `cacheMemberActivity`
- Return the full array of `MemberActivity`

**Error handling:**
- If a member's source fetch fails, store `null` for that source — never skip the member
- If Gemini focus summary fails, use a fallback: "Activity data available but summary unavailable"

**Definition of done:**
- Returns typed `MemberActivity[]` for all team members
- All fetches run in parallel
- Results cached in KV before returning

---

- [x] TASK-030 — POST /api/team/activity
**Refs:** REQ-006
**File:** `app/api/team/activity/route.ts`
**Description:**
API route called by the Vercel cron job every hour.

**Must:**
- Identify all active teams (or accept `teamId` as a query param for targeted refresh)
- Call `aggregateTeamActivity` for each team
- Return `{ status: 'ok', membersUpdated: number }`

**Definition of done:**
- Route callable by Vercel cron without user session
- Uses a shared cron secret (`CRON_SECRET` env var) for auth
- Handles partial failures per team gracefully

---

## Phase 11 — Overlap Detection

- [x] TASK-031 — lib/team/overlaps.ts — structural detection
**Refs:** REQ-007
**File:** `lib/team/overlaps.ts`
**Description:**
Implement `detectStructuralOverlaps(activities: MemberActivity[]): Overlap[]`

**Pass 1 — Structural (no AI):**
- CONFLICT: same file path appears in two members' `modifiedFiles` AND both members have open pull requests
- AWARENESS (repo): same repo name appears in two members' `touchedRepos`
- AWARENESS (path): same directory prefix appears in two members' `touchedPaths`

**Each Overlap must include:**
- Unique `id` (UUID)
- `type`: `'conflict' | 'awareness'`
- `memberIds`: the two affected members
- `reason`: human-readable string (e.g., "Both modifying src/lib/auth/")
- `repos` and `paths` arrays
- `detectedAt`: ISO timestamp

**Definition of done:**
- Returns correctly typed `Overlap[]`
- No false positives for unrelated repos/paths
- Handles edge case of single-member team (returns empty array)

---

- [x] TASK-032 — lib/ai/analyzeOverlaps.ts — semantic detection
**Refs:** REQ-007
**File:** `lib/ai/analyzeOverlaps.ts`
**Description:**
Implement `analyzeSemanticOverlaps(activities: MemberActivity[]): Promise<Overlap[]>`

**Must:**
- Build a prompt from each member's `focusSummary`, pull request titles, and Jira ticket titles
- Send to gemini API using the overlap analysis prompt from `prompts.ts`
- Parse the JSON response into `Overlap[]` with `type: 'synergy'`
- Be conservative — only flag genuine semantic overlaps

**Error handling:**
- If gemini returns malformed JSON, log the error and return `[]`
- Never throw — return empty array on any failure

**Definition of done:**
- Returns `Overlap[]` with `type: 'synergy'` for semantically similar work
- Handles gemini API errors gracefully
- Prompt is sourced from `lib/ai/prompts.ts`

---

- [x] TASK-033 — POST /api/team/overlaps
**Refs:** REQ-007
**File:** `app/api/team/overlaps/route.ts`
**Description:**
Compute and cache overlaps for a team.

**Must:**
- Load today's `MemberActivity[]` from KV via `getAllMemberActivity`
- Run `detectStructuralOverlaps` (Pass 1)
- Run `analyzeSemanticOverlaps` (Pass 2)
- Merge results, deduplicate by member pair + type
- Store combined `Overlap[]` in KV via `cacheOverlaps`
- Return `{ overlaps: Overlap[] }`

**Definition of done:**
- Returns merged structural + semantic overlaps
- Deduplication prevents the same pair appearing twice with the same type
- Results cached in KV

---

## Phase 12 — gemini API Integration


- [x] TASK-035 — Update prompts.ts for gemini and team context
**Refs:** REQ-008, REQ-007
**File:** `lib/ai/prompts.ts`
**Description:**
Update all prompts to work with gemini and include team context.

**Must update `buildBriefingPrompt` to:**
- Accept `teamAlerts: TeamAlert[]` as a parameter
- Include team alerts section in the prompt
- Update word limit instruction to 400 words
- Keep all existing voice/TTS formatting rules

**Must add `buildOverlapAnalysisPrompt`:**
- Accepts `summaries: { userId: string; focusSummary: string; prTitles: string[]; ticketTitles: string[] }[]`
- Returns the overlap analysis prompt string
- Instructs gemini to return only valid JSON

**Must add `buildFocusSummaryPrompt`:**
- Accepts a single member's raw activity
- Returns a prompt that asks gemini for a 1-sentence focus summary

**Definition of done:**
- All three prompt builder functions exported
- Prompts tested manually against gemini API
- No hardcoded member data in prompt strings

---

## Phase 13 — Updated Briefing Pipeline

- [x] TASK-036 — Update /api/briefing/generate with team overlaps
**Refs:** REQ-008, REQ-007
**File:** `app/api/briefing/generate/route.ts`
**Description:**
Update the briefing generation pipeline to include team overlap data.

**Updated pipeline:**
```
1. Authenticate request (valid session required)
2. Check cache — return existing briefing if found
3. Fetch user's MemberActivity from KV (or generate if missing)
4. Fetch team Overlap[] from KV, filter to overlaps involving this user
5. Convert relevant Overlaps to TeamAlert[] for the briefing prompt
6. Fetch all sources in parallel with Promise.allSettled
7. Call synthesizeBriefing with activity data + TeamAlert[]
8. Build DailyBriefing with relevantOverlaps populated, audioUrl: null
9. Cache the briefing
10. Return briefing as JSON
```

**Definition of done:**
- Returns `DailyBriefing` with `relevantOverlaps` populated and `audioUrl: null`
- Team alerts appear in the briefing content
- Existing caching behavior preserved
- Audio generation removed from this route (moved to TASK-044)

---

- [x] TASK-044 — POST /api/briefing/audio
**Refs:** REQ-009, REQ-010
**File:** `app/api/briefing/audio/route.ts`

**Description:**
On-demand audio generation endpoint. Decoupled from briefing text generation so the dashboard loads immediately without waiting for ElevenLabs.

**Pipeline:**
```
1. Authenticate request (valid session required)
2. Load today's cached DailyBriefing — return 404 if not found
3. If briefing.audioUrl already exists — return it immediately (idempotent)
4. Build spoken text from briefing content:
   summary + achievements + blocker descriptions + pending titles
5. Call generateAudio(spokenText, userId, today) via lib/voice/tts.ts
6. Update the cached briefing with the new audioUrl
7. Return { audioUrl }
```

**Error handling:**
- If no briefing in cache → 404 with descriptive message
- If briefing has no content → 422
- If ElevenLabs fails → 500 with error message

**Definition of done:**
- Returns `{ audioUrl: string }` on success
- Calling the endpoint a second time returns the cached URL without re-generating
- Briefing cache is updated so page reload restores the audio player automatically

---

## Phase 14 — Team Dashboard UI

- [x] TASK-037 — MemberCard component
**Refs:** REQ-012
**File:** `components/team/MemberCard.tsx`
**Description:**
Display one team member's current focus.

**Props:** `{ member: TeamMember; activity: MemberActivity | null }`

**Must show:**
- Member avatar and name
- `focusSummary` text (or "No recent activity" if activity is null)
- Connection status dots (GitHub, Google, Jira)
- Last updated timestamp

**Privacy rule:** Never display raw file paths, commit messages, or ticket IDs.

**Definition of done:**
- Renders correctly for active and inactive members
- "No recent activity" shown without negative framing
- Touch-friendly on mobile

---

- [x] TASK-038 — OverlapAlert component
**Refs:** REQ-007, REQ-012
**File:** `components/team/OverlapAlert.tsx`
**Description:**
Display a single overlap card in the team dashboard.

**Props:** `{ overlap: Overlap; members: TeamMember[] }`

**Must show:**
- Overlap type badge: CONFLICT (red), SYNERGY (blue), AWARENESS (yellow)
- Member names involved
- `reason` text
- For CONFLICT: prominent warning styling
- For SYNERGY: suggestion to sync

**Definition of done:**
- Three visual variants render correctly
- CONFLICT variant is visually distinct and prominent
- No raw file paths shown (use `reason` field only)

---

- [x] TASK-039 — TeamFeed component
**Refs:** REQ-012
**File:** `components/team/TeamFeed.tsx`
**Description:**
Display all team members' activity in a scrollable feed.

**Props:** `{ members: TeamMember[]; activities: MemberActivity[] }`

**Must:**
- Render one `MemberCard` per team member
- Sort: members with recent activity first, inactive members last
- Show a loading skeleton while data is fetching

**Definition of done:**
- All team members rendered
- Sort order correct
- Loading state handled

---

- [x] TASK-040 — TeamTimeline component
**Refs:** REQ-012
**File:** `components/team/TeamTimeline.tsx`
**Description:**
Display a shared timeline of today's team meetings.

**Props:** `{ activities: MemberActivity[] }`

**Must:**
- Aggregate all `CalendarEvent[]` from all members' Google activity
- Deduplicate events that appear on multiple members' calendars (match by title + start time)
- Display events in chronological order with time and title
- Show attendee count (not names)

**Definition of done:**
- Shared meetings shown once even if multiple members have them
- Events sorted chronologically
- Empty state shown if no calendar data is available

---

- [x] TASK-041 — Team dashboard page
**Refs:** REQ-012
**File:** `app/dashboard/team/page.tsx`
**Description:**
Build the team intelligence view.

**Layout:**
1. **Overlaps section:** Active overlaps grouped by type (CONFLICT first, then SYNERGY, then AWARENESS), rendered as `OverlapAlert` cards
2. **Team feed:** `TeamFeed` component with all member cards
3. **Timeline:** `TeamTimeline` component

**On load:**
- Fetch team members from KV
- Fetch today's `MemberActivity[]` for all members
- Fetch today's `Overlap[]` for the team

**Definition of done:**
- All three sections render with real data
- CONFLICT overlaps appear at the top
- Page is mobile-responsive

---

## Phase 15 — Updated Voice Assistant

- [x] TASK-042 — Update /api/assistant/session with team context
**Refs:** REQ-011
**File:** `app/api/assistant/session/route.ts`
**Description:**
Update the assistant session to include full team context.

**Updated context loading:**
```
1. Load user's DailyBriefing from KV
2. Load all MemberActivity[] for the team (focusSummary only)
3. Load all Overlap[] for the team today
4. Build system prompt with all three context sections
5. Initialize ElevenLabs Conversational AI session
6. Return session token to client
```

**System prompt sections:**
- `== YOUR USER ==` — full briefing content
- `== TEAM ACTIVITY TODAY ==` — one line per member: "Name: focusSummary"
- `== ACTIVE OVERLAPS ==` — overlap reason strings

**Privacy rule in prompt:** Never reveal raw file paths, commit SHAs, or ticket IDs of other members.

**Definition of done:**
- Session context includes all three sections
- Agent can answer questions about teammates using focusSummary data
- Privacy rules enforced in the system prompt

---

## Phase 16 — Vercel Cron Configuration

- [x] TASK-043 — vercel.json cron configuration
**Refs:** REQ-006
**File:** `vercel.json`
**Description:**
Add Vercel cron configuration to trigger team activity aggregation every hour on weekdays.

**`vercel.json` content:**
```json
{
  "crons": [{
    "path": "/api/team/activity",
    "schedule": "0 6-22 * * 1-5"
  }]
}
```

**Must also:**
- Add `CRON_SECRET` to `.env.local` and document it in the env vars summary below
- Update `/api/team/activity` to validate the `Authorization: Bearer {CRON_SECRET}` header
- Reject requests without a valid cron secret with 401

**Definition of done:**
- `vercel.json` exists with correct cron schedule
- `/api/team/activity` rejects unauthorized requests
- Cron runs hourly on weekdays 6am–10pm UTC

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

# Cron
CRON_SECRET=

# Demo
DEMO_MODE=false
```
