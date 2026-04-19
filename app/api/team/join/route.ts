import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { Team } from '@/types'

const MAX_TEAM_SIZE = 25

function buildTeamKey(teamId: string): string {
  return `team:${teamId}`
}

function buildInviteKey(inviteToken: string): string {
  return `invite:${inviteToken}`
}

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

type JoinTeamRequest = { inviteToken: string }
type JoinTeamResponse = { team: Team }
type ErrorResponse = { error: string }

export async function POST(
  request: NextRequest
): Promise<NextResponse<JoinTeamResponse | ErrorResponse>> {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id as string

  // 2. Parse and validate request body
  let body: JoinTeamRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const inviteToken = body?.inviteToken?.trim()
  if (!inviteToken) {
    return NextResponse.json(
      { error: 'inviteToken is required' },
      { status: 400 }
    )
  }

  // 3. Look up team via invite token index
  const kv = await getKv()
  if (!kv) {
    return NextResponse.json(
      { error: 'Storage not configured' },
      { status: 503 }
    )
  }

  let teamId: string | null
  try {
    teamId = await kv.get<string>(buildInviteKey(inviteToken))
  } catch (error) {
    console.error('[Team/Join] KV read failed (invite index):', error)
    return NextResponse.json(
      { error: 'Failed to look up invite token' },
      { status: 500 }
    )
  }

  if (!teamId) {
    return NextResponse.json(
      { error: 'Invite token not found or has expired' },
      { status: 400 }
    )
  }

  // 4. Fetch the team record
  let team: Team | null
  try {
    team = await kv.get<Team>(buildTeamKey(teamId))
  } catch (error) {
    console.error('[Team/Join] KV read failed (team record):', error)
    return NextResponse.json(
      { error: 'Failed to retrieve team' },
      { status: 500 }
    )
  }

  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 400 }
    )
  }

  // 5. Validate invite token matches and has not expired
  if (team.inviteToken !== inviteToken) {
    return NextResponse.json(
      { error: 'Invite token is invalid' },
      { status: 400 }
    )
  }

  const now = new Date()
  const expiresAt = new Date(team.inviteExpiresAt)
  if (now > expiresAt) {
    return NextResponse.json(
      { error: 'Invite token has expired' },
      { status: 400 }
    )
  }

  // 6. Enforce team size limit
  if (team.memberIds.length >= MAX_TEAM_SIZE) {
    return NextResponse.json(
      { error: 'Team is full — maximum of 25 members allowed' },
      { status: 400 }
    )
  }

  // 7. Skip if user is already a member
  if (team.memberIds.includes(userId)) {
    return NextResponse.json({ team }, { status: 200 })
  }

  // 8. Add user to team and persist
  const updatedTeam: Team = {
    ...team,
    memberIds: [...team.memberIds, userId],
  }

  try {
    // Preserve the remaining TTL by using a long expiry (teams outlive a single day)
    const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days
    await kv.set(buildTeamKey(teamId), updatedTeam, { ex: CACHE_TTL_SECONDS })
  } catch (error) {
    console.error('[Team/Join] KV write failed:', error)
    return NextResponse.json(
      { error: 'Failed to join team — storage error' },
      { status: 500 }
    )
  }

  return NextResponse.json({ team: updatedTeam }, { status: 200 })
}
