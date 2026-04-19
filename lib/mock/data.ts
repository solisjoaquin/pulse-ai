import type {
  GitHubActivity,
  GoogleActivity,
  JiraActivity,
  MemberActivity,
  TeamMember,
  Overlap,
} from '@/types'

const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

export const MOCK_GITHUB: GitHubActivity = {
  commits: [
    {
      sha: 'abc1234',
      message: 'Fix authentication bug in login flow',
      repo: 'pulse-app',
      timestamp: new Date().toISOString(),
    },
    {
      sha: 'def5678',
      message: 'Add ElevenLabs TTS integration',
      repo: 'pulse-app',
      timestamp: new Date().toISOString(),
    },
    {
      sha: 'ghi9012',
      message: 'Update briefing prompt for voice output',
      repo: 'pulse-app',
      timestamp: new Date().toISOString(),
    },
  ],
  openPRs: [
    {
      number: 42,
      title: 'Add Google Calendar integration',
      repo: 'pulse-app',
      url: 'https://github.com/pulse-app/pull/42',
      daysOpen: 2,
    },
    {
      number: 38,
      title: 'Refactor data source pipeline',
      repo: 'pulse-app',
      url: 'https://github.com/pulse-app/pull/38',
      daysOpen: 5,
    },
  ],
  pendingReviews: [
    {
      number: 51,
      title: 'Dashboard mobile layout fix',
      repo: 'pulse-app',
      url: 'https://github.com/pulse-app/pull/51',
      daysOpen: 1,
      author: 'maria',
    },
  ],
  closedIssues: [
    {
      number: 29,
      title: 'OAuth token not persisting on refresh',
      repo: 'pulse-app',
      url: 'https://github.com/pulse-app/issues/29',
    },
  ],
  mergedPRs: [
    {
      number: 40,
      title: 'Setup Vercel KV cache layer',
      repo: 'pulse-app',
      url: 'https://github.com/pulse-app/pull/40',
      daysOpen: 0,
    },
  ],
  modifiedFiles: [
    'src/lib/auth/session.ts',
    'src/lib/cache/briefing.ts',
    'src/components/dashboard/BriefingPlayer.tsx',
  ],
}

export const MOCK_GOOGLE: GoogleActivity = {
  events: [
    {
      id: '1',
      title: 'Daily Standup',
      start: `${today}T09:00:00Z`,
      end: `${today}T09:30:00Z`,
      attendees: 5,
      isVideo: true,
      hangoutLink: 'https://meet.google.com/abc',
    },
    {
      id: '2',
      title: 'Product Review',
      start: `${today}T11:00:00Z`,
      end: `${today}T12:00:00Z`,
      attendees: 8,
      isVideo: true,
    },
    {
      id: '3',
      title: '1:1 with Sarah',
      start: `${today}T15:00:00Z`,
      end: `${today}T15:30:00Z`,
      attendees: 2,
      isVideo: false,
    },
    {
      id: '4',
      title: 'Sprint Planning',
      start: `${today}T16:00:00Z`,
      end: `${today}T17:00:00Z`,
      attendees: 6,
      isVideo: true,
    },
  ],
  totalMeetingMinutes: 150,
}

export const MOCK_JIRA: JiraActivity = {
  sprintName: 'Sprint 12 — Voice Integration',
  inProgress: [
    {
      key: 'PULSE-84',
      title: 'Implement ElevenLabs Conversational AI session',
      priority: 'high',
      url: 'https://pulse.atlassian.net/browse/PULSE-84',
    },
    {
      key: 'PULSE-79',
      title: 'Build briefing audio player component',
      priority: 'medium',
      url: 'https://pulse.atlassian.net/browse/PULSE-79',
    },
  ],
  movedYesterday: [
    {
      key: 'PULSE-71',
      title: 'Set up NextAuth with GitHub OAuth',
      status: 'Done',
      priority: 'medium',
      url: 'https://pulse.atlassian.net/browse/PULSE-71',
    },
  ],
  blockers: [
    {
      key: 'PULSE-82',
      title: 'ElevenLabs voice ID not confirmed — blocking TTS',
      priority: 'high',
      url: 'https://pulse.atlassian.net/browse/PULSE-82',
    },
  ],
}

// ─── Mock team members ────────────────────────────────────────────────────────

export const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    userId: 'demo-user',
    teamId: 'demo-team',
    name: 'John D.',
    avatarUrl: '',
    timezone: 'America/Argentina/Cordoba',
    briefingTime: '08:00',
    connections: { github: true, google: true, jira: true },
  },
  {
    userId: 'user-am',
    teamId: 'demo-team',
    name: 'Ana M.',
    avatarUrl: '',
    timezone: 'America/Argentina/Cordoba',
    briefingTime: '08:00',
    connections: { github: true, google: true, jira: false },
  },
  {
    userId: 'user-mr',
    teamId: 'demo-team',
    name: 'Marcos R.',
    avatarUrl: '',
    timezone: 'America/Argentina/Cordoba',
    briefingTime: '08:00',
    connections: { github: true, google: true, jira: false },
  },
  {
    userId: 'user-lv',
    teamId: 'demo-team',
    name: 'Lucía V.',
    avatarUrl: '',
    timezone: 'America/Argentina/Cordoba',
    briefingTime: '08:00',
    connections: { github: true, google: true, jira: false },
  },
]

// ─── Mock member activities ───────────────────────────────────────────────────

export const MOCK_USER_ACTIVITY: MemberActivity = {
  userId: 'demo-user',
  date: today,
  focusSummary: 'Auth module token refresh fix and KV cache layer implementation.',
  touchedRepos: ['pulse-app'],
  touchedPaths: ['src/lib/auth/', 'src/lib/cache/'],
  touchedEpics: ['AUTH-2024', 'PERF-89'],
  github: MOCK_GITHUB,
  google: MOCK_GOOGLE,
  jira: MOCK_JIRA,
}

export const MOCK_ANA_ACTIVITY: MemberActivity = {
  userId: 'user-am',
  date: today,
  focusSummary: 'Auth module session handling refactor and login flow improvements.',
  touchedRepos: ['pulse-app'],
  touchedPaths: ['src/lib/auth/', 'src/components/auth/'],
  touchedEpics: ['AUTH-2024'],
  github: {
    commits: [
      { sha: 'jkl3456', message: 'Refactor session handler to use new token model', repo: 'pulse-app', timestamp: new Date().toISOString() },
      { sha: 'mno7890', message: 'Add session expiry UI feedback', repo: 'pulse-app', timestamp: new Date().toISOString() },
    ],
    openPRs: [
      { number: 51, title: 'Session handling refactor', repo: 'pulse-app', url: 'https://github.com/pulse-app/pull/51', daysOpen: 2 },
    ],
    pendingReviews: [],
    closedIssues: [],
    mergedPRs: [],
    modifiedFiles: ['src/lib/auth/session.ts', 'src/components/auth/LoginForm.tsx'],
  },
  google: {
    events: [
      { id: 'a1', title: 'Daily Standup', start: `${today}T09:00:00Z`, end: `${today}T09:30:00Z`, attendees: 5, isVideo: true },
      { id: 'a2', title: 'Auth Design Review', start: `${today}T14:00:00Z`, end: `${today}T14:30:00Z`, attendees: 3, isVideo: true },
    ],
    totalMeetingMinutes: 60,
  },
  jira: null,
}

export const MOCK_MARCOS_ACTIVITY: MemberActivity = {
  userId: 'user-mr',
  date: today,
  focusSummary: 'Redis caching layer for notifications service and background job queue.',
  touchedRepos: ['notifications-svc', 'pulse-infra'],
  touchedPaths: ['src/cache/', 'src/jobs/'],
  touchedEpics: ['INFRA-12'],
  github: {
    commits: [
      { sha: 'pqr1234', message: 'Add Redis cache for notification deduplication', repo: 'notifications-svc', timestamp: new Date().toISOString() },
      { sha: 'stu5678', message: 'Configure cache TTL per notification type', repo: 'notifications-svc', timestamp: new Date().toISOString() },
    ],
    openPRs: [
      { number: 18, title: 'Redis cache for notification deduplication', repo: 'notifications-svc', url: 'https://github.com/notifications-svc/pull/18', daysOpen: 1 },
    ],
    pendingReviews: [],
    closedIssues: [],
    mergedPRs: [],
    modifiedFiles: ['src/cache/redis.ts', 'src/jobs/notification-worker.ts'],
  },
  google: {
    events: [
      { id: 'm1', title: 'Daily Standup', start: `${today}T09:00:00Z`, end: `${today}T09:30:00Z`, attendees: 5, isVideo: true },
      { id: 'm2', title: 'Infra Sync', start: `${today}T10:00:00Z`, end: `${today}T10:30:00Z`, attendees: 4, isVideo: true },
    ],
    totalMeetingMinutes: 60,
  },
  jira: null,
}

export const MOCK_LUCIA_ACTIVITY: MemberActivity = {
  userId: 'user-lv',
  date: today,
  focusSummary: 'Dashboard UI components and mobile responsive layout improvements.',
  touchedRepos: ['pulse-app'],
  touchedPaths: ['src/components/dashboard/', 'src/components/ui/'],
  touchedEpics: ['UI-45'],
  github: {
    commits: [
      { sha: 'vwx9012', message: 'Mobile responsive fixes for BriefingPlayer', repo: 'pulse-app', timestamp: new Date().toISOString() },
      { sha: 'yza3456', message: 'Add touch targets to player controls', repo: 'pulse-app', timestamp: new Date().toISOString() },
    ],
    openPRs: [
      { number: 55, title: 'Mobile responsive dashboard layout', repo: 'pulse-app', url: 'https://github.com/pulse-app/pull/55', daysOpen: 1 },
    ],
    pendingReviews: [
      { number: 42, title: 'Token refresh fix for expired sessions', repo: 'pulse-app', url: 'https://github.com/pulse-app/pull/42', daysOpen: 1, author: 'demo-user' },
    ],
    closedIssues: [],
    mergedPRs: [],
    modifiedFiles: ['src/components/dashboard/BriefingPlayer.tsx', 'src/components/ui/Button.tsx'],
  },
  google: {
    events: [
      { id: 'l1', title: 'Daily Standup', start: `${today}T09:00:00Z`, end: `${today}T09:30:00Z`, attendees: 5, isVideo: true },
    ],
    totalMeetingMinutes: 30,
  },
  jira: null,
}

export const MOCK_ALL_ACTIVITIES: MemberActivity[] = [
  MOCK_USER_ACTIVITY,
  MOCK_ANA_ACTIVITY,
  MOCK_MARCOS_ACTIVITY,
  MOCK_LUCIA_ACTIVITY,
]

// ─── Mock overlaps ────────────────────────────────────────────────────────────

export const MOCK_OVERLAPS: Overlap[] = [
  {
    id: 'overlap-001',
    type: 'conflict',
    memberIds: ['demo-user', 'user-am'],
    reason: 'Both modifying src/lib/auth/ with open pull requests',
    detail: 'John has pull request forty-two touching token.ts and session.ts. Ana has pull request fifty-one touching session.ts. These will conflict on merge.',
    repos: ['pulse-app'],
    paths: ['src/lib/auth/'],
    detectedAt: new Date().toISOString(),
  },
  {
    id: 'overlap-002',
    type: 'synergy',
    memberIds: ['demo-user', 'user-mr'],
    reason: 'Both building caching layers for different services',
    detail: 'John built KV cache for briefings. Marcos is building Redis cache for notifications. Shared patterns around TTL and cache invalidation.',
    repos: ['pulse-app', 'notifications-svc'],
    paths: [],
    detectedAt: new Date().toISOString(),
  },
  {
    id: 'overlap-003',
    type: 'awareness',
    memberIds: ['demo-user', 'user-lv'],
    reason: 'Both active in pulse-app, different areas',
    detail: 'Lucía is working on dashboard UI components. No file overlap with your work.',
    repos: ['pulse-app'],
    paths: [],
    detectedAt: new Date().toISOString(),
  },
]
