import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { fetchGitHubActivity } from '@/lib/sources/github'
import { fetchGoogleActivity } from '@/lib/sources/google'
import { fetchJiraActivity } from '@/lib/sources/jira'
import { getCachedOverlaps } from '@/lib/cache/team'
import { MOCK_OVERLAPS } from '@/lib/mock/data'
import type { GitHubActivity, GoogleActivity, JiraActivity, Overlap, Team } from '@/types'

// ─── KV helper ────────────────────────────────────────────────────────────────

async function getKv(): Promise<import('@vercel/kv').VercelKV | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  try {
    const { kv } = await import('@vercel/kv')
    return kv
  } catch {
    return null
  }
}

async function findTeamIdForUser(userId: string): Promise<string | null> {
  try {
    const kv = await getKv()
    if (!kv) return null
    const keys = await kv.keys('team:*')
    if (keys.length === 0) return null
    const teams = await Promise.all(keys.map((key) => kv.get<Team>(key)))
    for (const team of teams) {
      if (team && team.memberIds.includes(userId)) return team.id
    }
    return null
  } catch {
    return null
  }
}

// ─── Response type ────────────────────────────────────────────────────────────

export interface DashboardData {
  github: GitHubActivity | null
  google: GoogleActivity | null
  jira: JiraActivity | null
  overlaps: Overlap[]
}

type ErrorResponse = { error: string }

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<DashboardData | ErrorResponse>> {
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const session = await auth()

  if (!isDemoMode && !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId: string = isDemoMode ? 'demo-user' : (session!.user!.id as string)
  const today = new Date().toISOString().split('T')[0]

  // Fetch sources and overlaps in parallel
  const [githubResult, googleResult, jiraResult, overlapsResult] = await Promise.allSettled([
    isDemoMode || session?.githubAccessToken
      ? fetchGitHubActivity(session?.githubAccessToken ?? '')
      : Promise.resolve(null),
    isDemoMode || session?.googleAccessToken
      ? fetchGoogleActivity(session?.googleAccessToken ?? '')
      : Promise.resolve(null),
    isDemoMode || (session?.jiraToken && session?.jiraDomain)
      ? fetchJiraActivity(session?.jiraToken ?? '', session?.jiraDomain ?? '')
      : Promise.resolve(null),
    isDemoMode
      ? Promise.resolve(MOCK_OVERLAPS)
      : (async () => {
          const teamId = await findTeamIdForUser(userId)
          if (!teamId) return []
          return (await getCachedOverlaps(teamId, today)) ?? []
        })(),
  ])

  return NextResponse.json({
    github: githubResult.status === 'fulfilled' ? githubResult.value : null,
    google: googleResult.status === 'fulfilled' ? googleResult.value : null,
    jira: jiraResult.status === 'fulfilled' ? jiraResult.value : null,
    overlaps: overlapsResult.status === 'fulfilled' ? overlapsResult.value : [],
  })
}
