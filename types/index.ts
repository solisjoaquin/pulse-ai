// ─── Team Types ───────────────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
  memberIds: string[]
  inviteToken: string
  inviteExpiresAt: string // ISO 8601 — 72 hours from creation
  createdAt: string
}

export interface TeamMember {
  userId: string
  teamId: string
  name: string
  avatarUrl: string
  timezone: string
  briefingTime: string // HH:MM
  connections: {
    github: boolean
    google: boolean
    jira: boolean
  }
}

export interface MemberActivity {
  userId: string
  date: string // YYYY-MM-DD
  github: GitHubActivity | null
  google: GoogleActivity | null
  jira: JiraActivity | null
  focusSummary: string // Claude-derived: "Working on auth refactor and caching layer"
  touchedRepos: string[] // ["pulse-app", "pulse-infra"]
  touchedPaths: string[] // ["src/lib/auth/", "src/components/"]
  touchedEpics: string[] // ["AUTH-2024", "PERF-89"]
}

export interface Overlap {
  id: string
  type: 'conflict' | 'synergy' | 'awareness'
  memberIds: [string, string]
  reason: string // Human-readable: "Both modifying src/lib/auth/"
  detail: string // More context for the assistant
  repos: string[]
  paths: string[]
  detectedAt: string // ISO 8601
}

export interface TeamAlert {
  type: 'conflict' | 'synergy' | 'awareness'
  message: string // Spoken-friendly alert text
  withMember: string // First name only: "Ana"
}

// ─── Core Briefing Types ──────────────────────────────────────────────────────

export interface DailyBriefing {
  id: string
  userId: string
  date: string // YYYY-MM-DD
  status: 'pending' | 'generating' | 'ready' | 'error'
  sources: {
    github: GitHubActivity | null
    google: GoogleActivity | null
    jira: JiraActivity | null
  }
  content: BriefingContent | null
  audioUrl: string | null
  relevantOverlaps: Overlap[] // Only overlaps involving this user
  generatedAt: string | null
}

export interface BriefingContent {
  summary: string // 1-2 opening sentences
  achievements: string[] // What was completed
  pending: PendingItem[] // Open PRs, tickets, tasks
  blockers: BlockerItem[] // Ordered by urgency
  todaySchedule: CalendarEvent[] // Today's meetings
  teamAlerts: TeamAlert[] // Overlap-derived alerts for this user
  wordCount: number
}

export interface PendingItem {
  id: string
  title: string
  type: 'pr' | 'issue' | 'ticket'
  repo?: string
  daysOpen?: number
  url?: string
}

export interface BlockerItem {
  id: string
  title: string
  source: 'github' | 'jira'
  urgency: 'high' | 'medium' | 'low'
  description?: string
}

// ─── GitHub Types ─────────────────────────────────────────────────────────────

export interface GitHubActivity {
  commits: Commit[]
  openPRs: PullRequest[]
  pendingReviews: PullRequest[]
  closedIssues: Issue[]
  mergedPRs: PullRequest[]
  modifiedFiles: string[] // All unique file paths touched in the last 24 hours
}

export interface Commit {
  sha: string
  message: string
  repo: string
  timestamp: string
}

export interface PullRequest {
  number: number
  title: string
  repo: string
  url: string
  daysOpen: number
  author?: string
}

export interface Issue {
  number: number
  title: string
  repo: string
  url: string
}

// ─── Google Calendar Types ────────────────────────────────────────────────────

export interface GoogleActivity {
  events: CalendarEvent[]
  totalMeetingMinutes: number
}

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO 8601
  end: string // ISO 8601
  attendees: number // count only
  isVideo: boolean
  hangoutLink?: string
}

// ─── Jira Types ───────────────────────────────────────────────────────────────

export interface JiraActivity {
  inProgress: JiraTicket[]
  movedYesterday: JiraTicket[]
  blockers: JiraTicket[]
  sprintName: string
}

export interface JiraTicket {
  key: string
  title: string
  status?: string
  priority: 'high' | 'medium' | 'low'
  url?: string
}
