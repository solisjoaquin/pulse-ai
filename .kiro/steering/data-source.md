# Pulse — Data Sources Steering

## Core Principle
Data sources are the foundation of the briefing. Each source is
independent — one failing must never block the others. The briefing
should always generate, even if every source returns null.

## The Source Contract

Every source function in `/lib/sources/` MUST follow this contract:

```typescript
// Signature pattern — all sources follow this shape
async function fetchXxxActivity(token: string): Promise<XxxActivity | null>

// Rules:
// 1. Never throw — catch all errors internally and return null
// 2. Always log the error before returning null
// 3. Return the full typed object or null — no partial returns
// 4. All fetches have a timeout of 10 seconds maximum
```

## Parallel Fetching

All sources MUST be fetched in parallel using `Promise.allSettled`.
Never fetch sources sequentially — it wastes time.

```typescript
// Correct pattern in /api/briefing/generate
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

## GitHub Source

### API Base URL
`https://api.github.com`

### Auth header
`Authorization: Bearer {token}`
`X-GitHub-Api-Version: 2022-11-28`

### Endpoints to use
| Data | Endpoint |
|---|---|
| Commits (last 24h) | `GET /search/commits?q=author:{username}+committer-date:>{yesterday}` |
| Open PRs authored | `GET /search/issues?q=author:{username}+type:pr+state:open` |
| Pending reviews | `GET /search/issues?q=review-requested:{username}+type:pr+state:open` |
| Closed issues | `GET /search/issues?q=assignee:{username}+type:issue+state:closed+closed:>{yesterday}` |
| Merged PRs | `GET /search/issues?q=author:{username}+type:pr+is:merged+merged:>{yesterday}` |

### Time window
Always use "last 24 hours" relative to the moment of generation.
Compute `yesterday` as: `new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()`

### Rate limits
GitHub REST API allows 5000 requests/hour for authenticated users.
Each briefing generation uses ~5 requests. No rate limit concerns for MVP.

## Google Calendar Source

### API Base URL
`https://www.googleapis.com/calendar/v3`

### Auth header
`Authorization: Bearer {token}`

### Endpoint to use
`GET /calendars/primary/events`

### Query parameters
```
timeMin: start of today in ISO 8601 (midnight in user's timezone)
timeMax: end of today in ISO 8601 (23:59:59 in user's timezone)
singleEvents: true
orderBy: startTime
maxResults: 20
```

### Timezone handling
Always use the user's local timezone for timeMin/timeMax.
Read timezone from the Google Calendar settings endpoint on first auth:
`GET /users/me/settings/timezone`
Store it in the session alongside the token.

### What to extract per event
- `summary` (title)
- `start.dateTime` and `end.dateTime`
- `attendees.length` (count only, not individual names for privacy)
- `hangoutLink` (if present, it's a video call)

## Jira Source

### API Base URL
`https://{domain}.atlassian.net/rest/api/3`

### Auth
Jira uses Basic Auth with API token:
`Authorization: Basic base64("{email}:{apiToken}")`

### JQL queries to use
| Data | JQL |
|---|---|
| In progress tickets | `assignee = currentUser() AND status = "In Progress"` |
| Moved yesterday | `assignee = currentUser() AND updated >= -1d` |
| Blockers | `sprint in openSprints() AND labels = "blocker" AND assignee = currentUser()` |

### MVP note
Jira integration is optional for MVP. If `session.jiraToken` is null,
skip the fetch entirely and pass `null` to the briefing pipeline.
The UI shows a yellow dot for Jira in SourceStatus component.

## Demo Mode Data

When `DEMO_MODE=true`, all source functions return this mock data
instead of making real API calls.

### Mock GitHub data
```typescript
{
  commits: [
    { sha: 'abc1234', message: 'Fix authentication bug in login flow', repo: 'pulse-app' },
    { sha: 'def5678', message: 'Add ElevenLabs TTS integration', repo: 'pulse-app' },
    { sha: 'ghi9012', message: 'Update briefing prompt for voice output', repo: 'pulse-app' },
  ],
  openPRs: [
    { number: 42, title: 'Add Google Calendar integration', repo: 'pulse-app', daysOpen: 2 },
    { number: 38, title: 'Refactor data source pipeline', repo: 'pulse-app', daysOpen: 5 },
  ],
  pendingReviews: [
    { number: 51, title: 'Dashboard mobile layout fix', repo: 'pulse-app', author: 'maria' },
  ],
  closedIssues: [
    { number: 29, title: 'OAuth token not persisting on refresh', repo: 'pulse-app' },
  ],
  mergedPRs: [
    { number: 40, title: 'Setup Vercel KV cache layer', repo: 'pulse-app' },
  ],
}
```

### Mock Google data
```typescript
{
  events: [
    { title: 'Daily Standup', start: '09:00', end: '09:30', attendees: 5, isVideo: true },
    { title: 'Product Review', start: '11:00', end: '12:00', attendees: 8, isVideo: true },
    { title: '1:1 with Sarah', start: '15:00', end: '15:30', attendees: 2, isVideo: false },
    { title: 'Sprint Planning', start: '16:00', end: '17:00', attendees: 6, isVideo: true },
  ],
  totalMeetingMinutes: 150,
}
```

### Mock Jira data
```typescript
{
  sprintName: 'Sprint 12 — Voice Integration',
  inProgress: [
    { key: 'PULSE-84', title: 'Implement ElevenLabs Conversational AI session', priority: 'high' },
    { key: 'PULSE-79', title: 'Build briefing audio player component', priority: 'medium' },
  ],
  movedYesterday: [
    { key: 'PULSE-71', title: 'Set up NextAuth with GitHub OAuth', status: 'Done' },
  ],
  blockers: [
    { key: 'PULSE-82', title: 'ElevenLabs voice ID not confirmed — blocking TTS', priority: 'high' },
  ],
}
```