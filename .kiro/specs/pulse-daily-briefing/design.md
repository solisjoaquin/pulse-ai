# Pulse — Design

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript (strict, no `any`)
- **Styling:** Tailwind CSS
- **Auth:** NextAuth.js (OAuth — GitHub, Google)
- **AI:** gemini API (`@google/generative-ai`) — `gemini-2.5-flash`
- **Voice:** ElevenLabs TTS + Conversational AI
- **Storage:** Vercel KV (sessions, cache, team data)
- **Blob:** Vercel Blob (audio MP3 files)
- **Deployment:** Vercel

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    Next.js App                        │
│                                                       │
│  ┌────────────┐    ┌───────────────────────────────┐  │
│  │   Client   │    │         API Routes            │  │
│  │            │    │                               │  │
│  │ Dashboard  │───▶│ /api/briefing/generate        │  │
│  │ Team view  │───▶│ /api/team/activity            │  │
│  │ Player     │    │ /api/team/overlaps            │  │
│  │ Assistant  │───▶│ /api/assistant/session        │  │
│  └────────────┘    └──────────────┬────────────────┘  │
└─────────────────────────────────  ┼ ──────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────┐
         │                          │                       │
         ▼                          ▼                       ▼
   GitHub API               Google API               Jira API
   per team member          per team member          per team member
         │                          │                       │
         └──────────────────────────┼───────────────────────┘
                                    │
                              Vercel KV
                         (team activity cache)
                                    │
                                    ▼
                             gemini API
                    (personal briefing + overlap analysis)
                                    │
                                    ▼
                          ElevenLabs API
                      (TTS + Conversational AI)
```

---

## Folder Structure

```
pulse/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx            # Landing + onboarding
│   │   └── callback/page.tsx         # OAuth callback
│   ├── onboarding/
│   │   ├── sources/page.tsx          # Connect data sources
│   │   └── team/page.tsx             # Create or join team
│   ├── dashboard/
│   │   ├── page.tsx                  # Personal briefing view
│   │   └── team/page.tsx             # Team intelligence view
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── briefing/
│   │   │   ├── generate/route.ts     # Personal briefing pipeline
│   │   │   └── status/route.ts       # Briefing cache check
│   │   ├── team/
│   │   │   ├── create/route.ts       # Create team
│   │   │   ├── join/route.ts         # Join via invite link
│   │   │   ├── activity/route.ts     # Aggregate team activity
│   │   │   └── overlaps/route.ts     # Compute overlaps
│   │   └── assistant/
│   │       └── session/route.ts      # ElevenLabs Conv. AI session
│   └── layout.tsx
├── components/
│   ├── onboarding/
│   │   ├── OnboardingFlow.tsx
│   │   └── SourceCard.tsx
│   ├── dashboard/
│   │   ├── BriefingPlayer.tsx        # Audio player
│   │   ├── TranscriptPanel.tsx
│   │   ├── SourceStatus.tsx
│   │   └── AssistantButton.tsx
│   ├── team/
│   │   ├── TeamFeed.tsx              # Activity per member
│   │   ├── MemberCard.tsx            # One member's focus
│   │   ├── OverlapAlert.tsx          # Conflict/synergy/awareness card
│   │   └── TeamTimeline.tsx          # Shared meetings today
│   └── ui/
├── lib/
│   ├── sources/
│   │   ├── github.ts                 # Fetch one user's GitHub activity
│   │   ├── google.ts                 # Fetch one user's Calendar
│   │   └── jira.ts                   # Fetch one user's Jira activity
│   ├── team/
│   │   ├── aggregate.ts              # Fetch activity for all members
│   │   └── overlaps.ts               # Overlap detection logic
│   ├── ai/
│   │   ├── synthesize.ts             # Personal briefing via gemini
│   │   ├── analyzeOverlaps.ts        # Semantic overlap via gemini
│   │   └── prompts.ts                # All prompts centralized
│   ├── voice/
│   │   ├── tts.ts                    # ElevenLabs TTS
│   │   └── conversational.ts         # ElevenLabs Conv. AI
│   └── cache/
│       ├── briefing.ts               # KV: personal briefing cache
│       └── team.ts                   # KV: team activity cache
├── types/
│   └── index.ts
└── .kiro/
    ├── specs/
    │   ├── requirements.md
    │   ├── design.md
    │   └── tasks.md
    └── steering/
        ├── project.md
        ├── voice.md
        └── data-sources.md
```

---

## Data Models

```typescript
// Team
interface Team {
  id: string
  name: string
  memberIds: string[]
  inviteToken: string
  inviteExpiresAt: string        // ISO 8601 — 72 hours from creation
  createdAt: string
}

// Team member profile stored in KV
interface TeamMember {
  userId: string
  teamId: string
  name: string
  avatarUrl: string
  timezone: string
  briefingTime: string           // HH:MM
  connections: {
    github: boolean
    google: boolean
    jira: boolean
  }
}

// Activity for one member, one day
interface MemberActivity {
  userId: string
  date: string                   // YYYY-MM-DD
  github: GitHubActivity | null
  google: GoogleActivity | null
  jira: JiraActivity | null
  focusSummary: string           // gemini-derived: "Working on auth refactor and caching layer"
  touchedRepos: string[]         // ["pulse-app", "pulse-infra"]
  touchedPaths: string[]         // ["src/lib/auth/", "src/components/"]
  touchedEpics: string[]         // ["AUTH-2024", "PERF-89"]
}

// Detected overlap between two members
interface Overlap {
  id: string
  type: 'conflict' | 'synergy' | 'awareness'
  memberIds: [string, string]
  reason: string                 // Human-readable: "Both modifying src/lib/auth/"
  detail: string                 // More context for the assistant
  repos: string[]
  paths: string[]
  detectedAt: string
}

// Personal briefing
interface DailyBriefing {
  id: string
  userId: string
  date: string                   // YYYY-MM-DD
  status: 'pending' | 'generating' | 'ready' | 'error'
  content: BriefingContent | null
  audioUrl: string | null
  relevantOverlaps: Overlap[]    // Only overlaps involving this user
  generatedAt: string | null
}

interface BriefingContent {
  summary: string
  achievements: string[]
  pending: PendingItem[]
  blockers: BlockerItem[]
  todaySchedule: CalendarEvent[]
  teamAlerts: TeamAlert[]        // Overlap-derived alerts for this user
  wordCount: number
}

interface TeamAlert {
  type: 'conflict' | 'synergy' | 'awareness'
  message: string                // Spoken-friendly alert text
  withMember: string             // First name only: "Ana"
}

// GitHub activity
interface GitHubActivity {
  commits: Commit[]
  openPRs: PullRequest[]
  pendingReviews: PullRequest[]
  closedIssues: Issue[]
  mergedPRs: PullRequest[]
  modifiedFiles: string[]        // All unique file paths touched
}

interface GoogleActivity {
  events: CalendarEvent[]
  totalMeetingMinutes: number
}

interface JiraActivity {
  inProgress: JiraTicket[]
  movedYesterday: JiraTicket[]
  blockers: JiraTicket[]
  sprintName: string
}
```

---

## Overlap Detection Logic

Implemented in `lib/team/overlaps.ts`. Runs after all member activity is aggregated. Two passes:

### Pass 1 — Structural (deterministic)
No AI needed. Compare raw data:

```typescript
// CONFLICT: same file appears in two members' modifiedFiles AND both have open PRs
// AWARENESS: same repo appears in both members' touchedRepos
// same directory prefix appears in both members' touchedPaths
```

### Pass 2 — Semantic (gemini)
Send pull request titles and ticket descriptions to gemini:

```
Given these work summaries from team members, identify pairs
who appear to be working on semantically similar features
even if in different repos or with different file paths.

Return JSON: Array of { memberIds, reason, type }

Member summaries:
{MEMBER_SUMMARIES}
```

gemini classifies as SYNERGY when intent overlaps but not code.

---

## API Routes — Detail

### `POST /api/team/create`
Creates a new Team record in Vercel KV.
Generates a unique `inviteToken` and sets `inviteExpiresAt` to 72 hours from now.
Adds the creating user as the first member.
Key: `team:{teamId}`

### `POST /api/team/join`
Validates the invite token and expiry.
Adds the joining user to the Team's `memberIds`.
Prompts the user to connect their Data_Sources if not already connected.

### `POST /api/team/activity`
Called every 60 minutes by a Vercel cron job.
Fetches activity for all team members in parallel.
Stores `MemberActivity` per member in Vercel KV.
Key: `activity:{teamId}:{userId}:{YYYY-MM-DD}`

### `POST /api/team/overlaps`
Called after `/api/team/activity` completes.
Runs structural detection, then semantic analysis via gemini.
Stores `Overlap[]` in KV.
Key: `overlaps:{teamId}:{YYYY-MM-DD}`

### `POST /api/briefing/generate`
Fetches user's `MemberActivity` + team `Overlap[]`.
Filters overlaps to only those involving this user.
Sends to gemini for briefing generation.
Sends result to ElevenLabs for audio.
Caches `DailyBriefing` in KV.
Key: `briefing:{userId}:{YYYY-MM-DD}`

### `GET /api/briefing/status`
Returns the briefing for today if it exists in cache.
If not found: `{ status: 'pending' }`.

### `POST /api/assistant/session`
Loads:
- User's `DailyBriefing`
- All team `MemberActivity` summaries (`focusSummary` only)
- All `Overlap[]` for the team today

Initializes ElevenLabs Conversational AI session with full context.

---

## gemini Prompts

### Personal briefing prompt (`prompts.ts`)

```
You are Pulse, a professional but warm work assistant.
Produce a spoken audio briefing for {userName}.

Rules:
- Under 400 words
- Flowing prose only — no bullet points, no markdown
- Second person ("you merged", "your PR")
- Lead with team conflicts if any, then personal blockers,
  then achievements, then today's schedule
- Team alerts must name the person ("Ana is also working on...")

IMPORTANT: This text will be converted to speech by a TTS engine.
Format rules:
- Write in flowing prose only, no lists or bullet points
- Spell out numbers under 10 ("three" not "3")
- Avoid abbreviations — write "pull request" not "PR"
- Use natural spoken transitions between sections
- Do not use any markdown formatting

Personal activity:
{PERSONAL_ACTIVITY}

Team alerts for this user:
{TEAM_ALERTS}

Return JSON matching BriefingContent interface.
```

### Overlap analysis prompt (`prompts.ts`)

```
You are analyzing work activity summaries from a software team.
Identify pairs of teammates who appear to be working on
semantically similar features or initiatives, even if in
different codebases or with different ticket numbers.

Be conservative — only flag genuine overlaps, not coincidental
use of common words. Return ONLY valid JSON.

Format: { overlaps: [{ memberIds: [id1, id2], reason: string, type: "synergy" | "awareness" }] }

Member summaries:
{SUMMARIES}
```

---

## ElevenLabs Conversational AI — Team Context

System prompt structure for the assistant session:

```
You are Pulse, a team work assistant.

== YOUR USER ==
{USER_BRIEFING_CONTENT}

== TEAM ACTIVITY TODAY ==
{MEMBER_FOCUS_SUMMARIES}
(one line per member: "Ana: Working on Stripe integration and payment webhooks")

== ACTIVE OVERLAPS ==
{OVERLAP_LIST}

Rules:
- Answer questions about teammates based ONLY on their activity summaries
- Never reveal raw file paths, commit SHAs, or ticket IDs of others
- If asked about someone not on the team, say you don't have that info
- Keep all answers under 3 sentences unless asked for more detail
```

---

## Vercel Cron

`vercel.json`:
```json
{
  "crons": [{
    "path": "/api/team/activity",
    "schedule": "0 6-22 * * 1-5"
  }]
}
```

Runs every hour on weekdays between 6am and 10pm UTC.
Individual timezone handling is done inside the route.

---

## Privacy Principles

1. Team members see only **derived summaries** of others' work (`focusSummary`), never raw commits or file paths in the UI.
2. The Voice_Assistant can reference file paths verbally only when directly asked and only within the same team.
3. OAuth tokens are server-side only, never in client state.
4. Team data is strictly scoped — no cross-team data leakage.
5. A member can disconnect a source at any time from settings.

---

## Kiro Steering Docs

Three files in `.kiro/steering/` that guide Kiro throughout development:

### `project.md` — Global context
- What Pulse is, tech stack, architecture decisions
- Naming conventions and folder structure
- Rule: all external API calls go in `/lib/`, never in components

### `voice.md` — Voice rules
- Text generated by gemini must never contain bullets (goes to TTS)
- Maximum 400 words per briefing
- Tone: professional but conversational, second person

### `data-sources.md` — Integration patterns
- Each source returns its typed object or `null` on error
- Always handle source failures gracefully
- OAuth tokens never touch the client
- All fetches run in parallel with `Promise.allSettled`

---

## Out of Scope (MVP)

- Slack or Linear integrations
- Native mobile app
- Briefing history beyond 7 days
- Multiple teams per user
- Admin roles within a team
- Real-time webhooks (60-minute polling is sufficient)
