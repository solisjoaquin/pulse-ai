import { NextRequest, NextResponse } from 'next/server'
import { aggregateTeamActivity } from '@/lib/team/aggregate'
import type { Team } from '@/types'

// Read env vars at the top of the file
const CRON_SECRET = process.env.CRON_SECRET

// KV helper — same lazy-load pattern used across the codebase
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

// Retrieve all team IDs from KV by scanning for `team:*` keys
async function getAllTeamIds(): Promise<string[]> {
  try {
    const kv = await getKv()
    if (!kv) {
      console.warn('[Activity] KV not configured — cannot list teams')
      return []
    }

    const keys = await kv.keys('team:*')
    // Keys are in the form `team:{teamId}` — extract the teamId portion
    return keys.map((key) => key.replace(/^team:/, ''))
  } catch (error) {
    console.error('[Activity] getAllTeamIds failed:', error)
    return []
  }
}

type ActivityResponse = { status: 'ok'; membersUpdated: number }
type ErrorResponse = { error: string }

export async function POST(
  request: NextRequest
): Promise<NextResponse<ActivityResponse | ErrorResponse>> {
  // 1. Validate cron secret — reject requests without a valid Authorization header
  const authHeader = request.headers.get('authorization')
  const expectedBearer = CRON_SECRET ? `Bearer ${CRON_SECRET}` : null

  if (!expectedBearer || authHeader !== expectedBearer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Determine which teams to refresh
  //    Accept an optional `teamId` query param for targeted single-team refresh
  const { searchParams } = new URL(request.url)
  const targetTeamId = searchParams.get('teamId')

  let teamIds: string[]

  if (targetTeamId) {
    // Targeted refresh — validate the team exists before proceeding
    try {
      const kv = await getKv()
      if (kv) {
        const team = await kv.get<Team>(`team:${targetTeamId}`)
        if (!team) {
          return NextResponse.json(
            { error: `Team not found: ${targetTeamId}` },
            { status: 404 }
          )
        }
      }
    } catch (error) {
      console.error('[Activity] Team lookup failed:', error)
      return NextResponse.json(
        { error: 'Failed to look up team' },
        { status: 500 }
      )
    }
    teamIds = [targetTeamId]
  } else {
    // Full refresh — aggregate all active teams
    teamIds = await getAllTeamIds()
  }

  if (teamIds.length === 0) {
    console.warn('[Activity] No teams found to refresh')
    return NextResponse.json({ status: 'ok', membersUpdated: 0 })
  }

  // 3. Aggregate activity for each team in parallel
  //    Use Promise.allSettled so a failure in one team never blocks the others
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  const results = await Promise.allSettled(
    teamIds.map((teamId) => aggregateTeamActivity(teamId, today))
  )

  // 4. Tally members updated — count fulfilled results only
  let membersUpdated = 0

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const teamId = teamIds[i]

    if (result.status === 'fulfilled') {
      membersUpdated += result.value.length
    } else {
      // Log the failure but continue — partial failures are handled gracefully
      console.error(
        `[Activity] aggregateTeamActivity failed for team ${teamId}:`,
        result.reason
      )
    }
  }

  return NextResponse.json({ status: 'ok', membersUpdated })
}
