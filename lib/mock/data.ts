import type { GitHubActivity, GoogleActivity, JiraActivity } from '@/types'

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
