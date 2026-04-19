# Pulse — Data Sources Steering v2
 
## Core Principle
Data sources are the foundation of the briefing. Each source is
independent — one failing must never block the others. Team activity
aggregation follows the same principle: one member failing must never
block the rest of the team's data from being processed.
 
---
 
## The Source Contract
 
Every function in `/lib/sources/` and `/lib/team/` MUST follow this contract:
 
```typescript
// Personal source — returns typed data or null on any error
async function fetchXxxActivity(token: string): Promise<XxxActivity | null>
 
// Team aggregation — returns array (may be partial) never throws
async function fetchTeamActivity(members: TeamMember[]): Promise<MemberActivity[]>
 
// Rules:
// 1. Never throw — catch all errors internally
// 2. Log the error before returning null or empty
// 3. Return the full typed object or null — no partial returns
// 4. All fetches timeout after 10 seconds maximum
// 5. Use Promise.allSettled for all parallel fetches
```
 
---
 
## Parallel Fetching — Personal Sources
 
```typescript
const [githubResult, googleResult, jiraResult] = await Promise.allSettled([
  fetchGitHubActivity(session.githubToken),
  fetchGoogleActivity(session.googleToken),
  fetchJiraActivity(session.jiraToken, session.jiraDomain),
])
 
const sources = {
  github: githubResult.status === 'fulfilled' ? githubResult.value : null,
  google: googleResult.status === 'fulfilled' ? googleResult.value : null,
  jira:   jiraResult.status === 'fulfilled'   ? jiraResult.value   : null,
}
```
 
## Parallel Fetching — Team Activity
 
```typescript
// In lib/team/aggregate.ts
const results = await Promise.allSettled(
  members.map(member => fetchMemberActivity(member))
)
 
const activities: MemberActivity[] = results
  .filter(r => r.status === 'fulfilled' && r.value !== null)
  .map(r => (r as PromiseFulfilledResult<MemberActivity>).value)
```
 
---
 
## GitHub Source
 
**Base URL:** `https://api.github.com`
**Auth:** `Authorization: Bearer {token}` + `X-GitHub-Api-Version: 2022-11-28`
 
| Data | Endpoint |
|---|---|
| Commits (last 24h) | `GET /search/commits?q=author:{username}+committer-date:>{yesterday}` |
| Open PRs authored | `GET /search/issues?q=author:{username}+type:pr+state:open` |
| Pending reviews | `GET /search/issues?q=review-requested:{username}+type:pr+state:open` |
| Closed issues | `GET /search/issues?q=assignee:{username}+type:issue+state:closed+closed:>{yesterday}` |
| Merged PRs | `GET /search/issues?q=author:{username}+type:pr+is:merged+merged:>{yesterday}` |
| Modified files | Extract from commit detail: `GET /repos/{owner}/{repo}/commits/{sha}` |
 
**Time window:** last 24 hours
`const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()`
 
**Important:** Store `modifiedFiles` as unique directory prefixes, not full paths.
`src/lib/auth/session.ts` → store as `src/lib/auth/`
This is what overlap detection uses to compare across members.
 
---
 
## Google Calendar Source
 
**Base URL:** `https://www.googleapis.com/calendar/v3`
**Auth:** `Authorization: Bearer {token}`
**Endpoint:** `GET /calendars/primary/events`
 
```
timeMin: start of today midnight (user's timezone)
timeMax: end of today 23:59:59 (user's timezone)
singleEvents: true
orderBy: startTime
maxResults: 20
```
 
Extract per event: `summary`, `start.dateTime`, `end.dateTime`,
`attendees.length`, `hangoutLink` presence.
 
---
 
## Jira Source
 
**Base URL:** `https://{domain}.atlassian.net/rest/api/3`
**Auth:** Basic — `base64("{email}:{apiToken}")`
 
| Data | JQL |
|---|---|
| In progress | `assignee = currentUser() AND status = "In Progress"` |
| Moved yesterday | `assignee = currentUser() AND updated >= -1d` |
| Blockers | `sprint in openSprints() AND labels = "blocker" AND assignee = currentUser()` |
 
Optional for MVP — if `session.jiraToken` is null, skip entirely.
 
---
 
## Overlap Detection — `lib/team/overlaps.ts`
 
Two passes. Run sequentially, structural first.
 
### Pass 1 — Structural (no AI)
 
```typescript
// CONFLICT: two members have modifiedFiles with the same directory prefix
//           AND both have open PRs
function detectStructuralOverlaps(activities: MemberActivity[]): Overlap[]
 
// For each pair of members:
// 1. Find intersection of touchedPaths
// 2. If intersection is non-empty AND both have openPRs.length > 0 → CONFLICT
// 3. If same repo in touchedRepos but no path overlap → AWARENESS
```
 
### Pass 2 — Semantic (Gemini)
 
Send `focusSummary` strings to Gemini to detect intent overlap.
Only run if there are 2+ members with activity.
 
```typescript
// In lib/ai/analyzeOverlaps.ts
// Input: MemberActivity[] with focusSummary populated
// Output: Overlap[] with type 'synergy' | 'awareness'
// Uses gemini-2.5-flash with JSON output
```
 
Gemini prompt for overlap analysis — always use this exact structure:
 
```
You are analyzing work summaries from a software development team.
Identify pairs of teammates working on semantically similar features
or initiatives, even if in different repos or with different ticket numbers.
 
Be conservative — only flag genuine overlaps, not coincidental shared words.
Classify as "synergy" when there is clear opportunity to collaborate or
share learnings. Classify as "awareness" when the similarity is loose.
 
Return ONLY valid JSON, no markdown, no backticks.
Format: { "overlaps": [{ "memberIds": ["id1", "id2"], "reason": "string", "type": "synergy" | "awareness" }] }
 
If no meaningful overlaps are found, return: { "overlaps": [] }
 
Member summaries:
{SUMMARIES}
```
 
---
 
## Mock Data — `lib/mock/data.ts`
 
Used when `DEMO_MODE=true`. Covers the authenticated user plus
three teammates, one conflict, one synergy, one awareness overlap.
 
### Mock: authenticated user (John D.)
 
```typescript
export const mockUserActivity: MemberActivity = {
  userId: 'user-jd',
  date: new Date().toISOString().split('T')[0],
  focusSummary: 'Auth module token refresh fix and KV cache layer implementation.',
  touchedRepos: ['pulse-app'],
  touchedPaths: ['src/lib/auth/', 'src/lib/cache/'],
  touchedEpics: ['AUTH-2024', 'PERF-89'],
  github: {
    commits: [
      { sha: 'abc1234', message: 'Fix token refresh on session expiry', repo: 'pulse-app' },
      { sha: 'def5678', message: 'Implement Vercel KV cache layer', repo: 'pulse-app' },
      { sha: 'ghi9012', message: 'Add cache TTL configuration', repo: 'pulse-app' },
    ],
    openPRs: [
      { number: 42, title: 'Token refresh fix for expired sessions', repo: 'pulse-app', daysOpen: 1 },
      { number: 38, title: 'Refactor data source pipeline', repo: 'pulse-app', daysOpen: 5 },
    ],
    pendingReviews: [
      { number: 51, title: 'Dashboard mobile layout fix', repo: 'pulse-app', author: 'lucia' },
    ],
    closedIssues: [
      { number: 29, title: 'OAuth token not persisting on refresh', repo: 'pulse-app' },
    ],
    mergedPRs: [
      { number: 40, title: 'Setup Vercel KV cache layer', repo: 'pulse-app' },
    ],
    modifiedFiles: ['src/lib/auth/session.ts', 'src/lib/auth/token.ts', 'src/lib/cache/briefing.ts'],
  },
  google: {
    events: [
      { title: 'Daily Standup', start: '09:00', end: '09:30', attendees: 5, isVideo: true },
      { title: 'Product Review', start: '11:00', end: '12:00', attendees: 8, isVideo: true },
      { title: '1:1 with Sarah', start: '15:00', end: '15:30', attendees: 2, isVideo: false },
      { title: 'Sprint Planning', start: '16:00', end: '17:00', attendees: 6, isVideo: true },
    ],
    totalMeetingMinutes: 150,
  },
  jira: {
    sprintName: 'Sprint 12 — Voice Integration',
    inProgress: [
      { key: 'PULSE-84', title: 'ElevenLabs Conversational AI session', priority: 'high' },
      { key: 'PULSE-79', title: 'Briefing audio player component', priority: 'medium' },
    ],
    movedYesterday: [
      { key: 'PULSE-71', title: 'NextAuth GitHub OAuth setup', status: 'Done' },
    ],
    blockers: [
      { key: 'PULSE-82', title: 'ElevenLabs voice ID not confirmed — blocking TTS', priority: 'high' },
    ],
  },
}
```
 
### Mock: teammate Ana M.
 
```typescript
export const mockAnaMActivity: MemberActivity = {
  userId: 'user-am',
  date: new Date().toISOString().split('T')[0],
  focusSummary: 'Auth module session handling refactor and login flow improvements.',
  touchedRepos: ['pulse-app'],
  touchedPaths: ['src/lib/auth/', 'src/components/auth/'],
  touchedEpics: ['AUTH-2024'],
  github: {
    commits: [
      { sha: 'jkl3456', message: 'Refactor session handler to use new token model', repo: 'pulse-app' },
      { sha: 'mno7890', message: 'Add session expiry UI feedback', repo: 'pulse-app' },
    ],
    openPRs: [
      { number: 51, title: 'Session handling refactor', repo: 'pulse-app', daysOpen: 2 },
    ],
    pendingReviews: [],
    closedIssues: [],
    mergedPRs: [],
    modifiedFiles: ['src/lib/auth/session.ts', 'src/components/auth/LoginForm.tsx'],
  },
  google: {
    events: [
      { title: 'Daily Standup', start: '09:00', end: '09:30', attendees: 5, isVideo: true },
      { title: 'Auth Design Review', start: '14:00', end: '14:30', attendees: 3, isVideo: true },
    ],
    totalMeetingMinutes: 60,
  },
  jira: null,
}
```
 
### Mock: teammate Marcos R.
 
```typescript
export const mockMarcosRActivity: MemberActivity = {
  userId: 'user-mr',
  date: new Date().toISOString().split('T')[0],
  focusSummary: 'Redis caching layer for notifications service and background job queue.',
  touchedRepos: ['notifications-svc', 'pulse-infra'],
  touchedPaths: ['src/cache/', 'src/jobs/'],
  touchedEpics: ['INFRA-12'],
  github: {
    commits: [
      { sha: 'pqr1234', message: 'Add Redis cache for notification deduplication', repo: 'notifications-svc' },
      { sha: 'stu5678', message: 'Configure cache TTL per notification type', repo: 'notifications-svc' },
    ],
    openPRs: [
      { number: 18, title: 'Redis cache for notification deduplication', repo: 'notifications-svc', daysOpen: 1 },
    ],
    pendingReviews: [],
    closedIssues: [],
    mergedPRs: [],
    modifiedFiles: ['src/cache/redis.ts', 'src/jobs/notification-worker.ts'],
  },
  google: {
    events: [
      { title: 'Daily Standup', start: '09:00', end: '09:30', attendees: 5, isVideo: true },
      { title: 'Infra Sync', start: '10:00', end: '10:30', attendees: 4, isVideo: true },
    ],
    totalMeetingMinutes: 60,
  },
  jira: null,
}
```
 
### Mock: teammate Lucía V.
 
```typescript
export const mockLuciaVActivity: MemberActivity = {
  userId: 'user-lv',
  date: new Date().toISOString().split('T')[0],
  focusSummary: 'Dashboard UI components and mobile responsive layout improvements.',
  touchedRepos: ['pulse-app'],
  touchedPaths: ['src/components/dashboard/', 'src/components/ui/'],
  touchedEpics: ['UI-45'],
  github: {
    commits: [
      { sha: 'vwx9012', message: 'Mobile responsive fixes for BriefingPlayer', repo: 'pulse-app' },
      { sha: 'yza3456', message: 'Add touch targets to player controls', repo: 'pulse-app' },
    ],
    openPRs: [
      { number: 55, title: 'Mobile responsive dashboard layout', repo: 'pulse-app', daysOpen: 1 },
    ],
    pendingReviews: [
      { number: 42, title: 'Token refresh fix for expired sessions', repo: 'pulse-app', author: 'user-jd' },
    ],
    closedIssues: [],
    mergedPRs: [],
    modifiedFiles: ['src/components/dashboard/BriefingPlayer.tsx', 'src/components/ui/Button.tsx'],
  },
  google: {
    events: [
      { title: 'Daily Standup', start: '09:00', end: '09:30', attendees: 5, isVideo: true },
    ],
    totalMeetingMinutes: 30,
  },
  jira: null,
}
```
 
### Mock: pre-computed overlaps
 
```typescript
export const mockOverlaps: Overlap[] = [
  {
    id: 'overlap-001',
    type: 'conflict',
    memberIds: ['user-jd', 'user-am'],
    reason: 'Both modifying src/lib/auth/ with open PRs',
    detail: 'John has PR #42 touching token.ts and session.ts. Ana has PR #51 touching session.ts. These will conflict on merge.',
    repos: ['pulse-app'],
    paths: ['src/lib/auth/'],
    detectedAt: new Date().toISOString(),
  },
  {
    id: 'overlap-002',
    type: 'synergy',
    memberIds: ['user-jd', 'user-mr'],
    reason: 'Both building caching layers for different services',
    detail: 'John built KV cache for briefings. Marcos is building Redis cache for notifications. Shared patterns around TTL and cache invalidation.',
    repos: ['pulse-app', 'notifications-svc'],
    paths: [],
    detectedAt: new Date().toISOString(),
  },
  {
    id: 'overlap-003',
    type: 'awareness',
    memberIds: ['user-jd', 'user-lv'],
    reason: 'Both active in pulse-app, different areas',
    detail: 'Lucía is working on dashboard UI components. No file overlap with John\'s work.',
    repos: ['pulse-app'],
    paths: [],
    detectedAt: new Date().toISOString(),
  },
]
```
 
### Mock: full team array
 
```typescript
export const mockTeamMembers: TeamMember[] = [
  { userId: 'user-jd', name: 'John D.',   avatarUrl: '', timezone: 'America/Argentina/Cordoba', connections: { github: true, google: true, jira: true } },
  { userId: 'user-am', name: 'Ana M.',    avatarUrl: '', timezone: 'America/Argentina/Cordoba', connections: { github: true, google: true, jira: false } },
  { userId: 'user-mr', name: 'Marcos R.', avatarUrl: '', timezone: 'America/Argentina/Cordoba', connections: { github: true, google: true, jira: false } },
  { userId: 'user-lv', name: 'Lucía V.',  avatarUrl: '', timezone: 'America/Argentina/Cordoba', connections: { github: true, google: true, jira: false } },
]
```