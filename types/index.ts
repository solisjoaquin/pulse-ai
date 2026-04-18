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
  generatedAt: string | null
}

export interface BriefingContent {
  summary: string // 1-2 opening sentences
  achievements: string[] // What was completed
  pending: PendingItem[] // Open PRs, tickets, tasks
  blockers: BlockerItem[] // Ordered by urgency
  todaySchedule: CalendarEvent[] // Today's meetings
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
