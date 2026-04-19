import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { fetchGitHubActivity } from '@/lib/sources/github'
import { fetchGoogleActivity } from '@/lib/sources/google'
import { fetchJiraActivity } from '@/lib/sources/jira'
import { synthesizeBriefing } from '@/lib/ai/synthesize'
import { getCachedBriefing, cacheBriefing } from '@/lib/cache/briefing'
import { getMemberActivity, getCachedOverlaps } from '@/lib/cache/team'
import { MOCK_OVERLAPS } from '@/lib/mock/data'
import type { DailyBriefing, Overlap, Team, TeamAlert } from '@/types'

// ─── KV helper ────────────────────────────────────────────────────────────────

async function getKv(): Promise<import('@vercel/kv').VercelKV | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null
  }
  try {
    const { kv } = await import('@vercel/kv')
    return kv
  } catch {
    return null
  }
}

/**
 * Find the teamId for a given user by scanning team records in KV.
 * Returns null if the user is not a member of any team or KV is unavailable.
 */
async function findTeamIdForUser(userId: string): Promise<string | null> {
  try {
    const kv = await getKv()
    if (!kv) return null

    const keys = await kv.keys('team:*')
    if (keys.length === 0) return null

    const teams = await Promise.all(keys.map((key) => kv.get<Team>(key)))

    for (const team of teams) {
      if (team && team.memberIds.includes(userId)) {
        return team.id
      }
    }

    return null
  } catch (error) {
    console.error('[API] findTeamIdForUser failed:', error)
    return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  // 1. Auth check
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const session = await auth()

  if (!isDemoMode && !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId: string = isDemoMode ? 'demo-user' : (session!.user!.id as string)
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // 2. Check cache
  const cached = await getCachedBriefing(userId, today)
  if (cached) {
    return NextResponse.json(cached)
  }

  // 3. Fetch user's MemberActivity from KV (requires teamId lookup)
  //    Used to enrich context; teamId is also needed for overlap lookup below.
  const teamId = isDemoMode ? null : await findTeamIdForUser(userId)

  // MemberActivity is fetched for future use (e.g. enriching the prompt with
  // pre-computed focusSummary). Currently the overlap pipeline is the primary
  // consumer; the variable is retained for forward compatibility.
  const _memberActivity = teamId
    ? await getMemberActivity(teamId, userId, today)
    : null

  // 4. Fetch team Overlap[] from KV, filter to overlaps involving this user
  //    In demo mode, use pre-loaded mock overlaps instead of KV.
  const allOverlaps: Overlap[] = isDemoMode
    ? MOCK_OVERLAPS
    : teamId
    ? (await getCachedOverlaps(teamId, today)) ?? []
    : []

  const relevantOverlaps: Overlap[] = allOverlaps.filter((overlap) =>
    overlap.memberIds.includes(userId)
  )

  // 5. Convert relevant Overlaps to TeamAlert[] for the briefing prompt
  const teamAlerts: TeamAlert[] = relevantOverlaps.map((overlap): TeamAlert => {
    // Identify the other member in this overlap
    const otherMemberId =
      overlap.memberIds[0] === userId ? overlap.memberIds[1] : overlap.memberIds[0]

    return {
      type: overlap.type,
      message: overlap.reason,
      withMember: otherMemberId,
    }
  })

  // 6. Fetch all sources in parallel
  const [githubResult, googleResult, jiraResult] = await Promise.allSettled([
    isDemoMode || session?.githubAccessToken
      ? fetchGitHubActivity(session?.githubAccessToken ?? '')
      : Promise.resolve(null),
    isDemoMode || session?.googleAccessToken
      ? fetchGoogleActivity(session?.googleAccessToken ?? '')
      : Promise.resolve(null),
    isDemoMode || (session?.jiraToken && session?.jiraDomain)
      ? fetchJiraActivity(session?.jiraToken ?? '', session?.jiraDomain ?? '')
      : Promise.resolve(null),
  ])

  const sources = {
    github: githubResult.status === 'fulfilled' ? githubResult.value : null,
    google: googleResult.status === 'fulfilled' ? googleResult.value : null,
    jira: jiraResult.status === 'fulfilled' ? jiraResult.value : null,
  }

  // 7. Synthesize briefing text via Gemini (with team alerts)
  let content
  try {
    content = await synthesizeBriefing({ ...sources, teamAlerts })
  } catch (error) {
    console.error('[API] synthesizeBriefing failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate briefing text' },
      { status: 500 }
    )
  }

  // 8. Build DailyBriefing object — audio is not generated yet (on-demand)
  const briefing: DailyBriefing = {
    id: `${userId}-${today}`,
    userId,
    date: today,
    status: 'ready',
    sources,
    content,
    audioUrl: null,
    relevantOverlaps,
    generatedAt: new Date().toISOString(),
  }

  // 9. Cache the briefing (without audio)
  await cacheBriefing(briefing)

  // 10. Return briefing
  return NextResponse.json(briefing)
}
