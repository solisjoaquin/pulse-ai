import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { Team } from '@/types'

const INVITE_TTL_HOURS = 72
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days — teams outlive a single day

function buildTeamKey(teamId: string): string {
  return `team:${teamId}`
}

function generateId(): string {
  // crypto.randomUUID() is available in Node 14.17+ and all modern edge runtimes
  return crypto.randomUUID()
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

type CreateTeamRequest = { name: string }
type CreateTeamResponse = { team: Team; inviteLink: string }
type ErrorResponse = { error: string }

export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateTeamResponse | ErrorResponse>> {
  // 1. Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = session.user.id as string

  // 2. Parse and validate request body
  let body: CreateTeamRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const name = body?.name?.trim()
  if (!name) {
    return NextResponse.json(
      { error: 'Team name is required' },
      { status: 400 }
    )
  }

  if (name.length > 100) {
    return NextResponse.json(
      { error: 'Team name must be 100 characters or fewer' },
      { status: 400 }
    )
  }

  // 3. Build the Team object
  const teamId = generateId()
  const inviteToken = generateId()
  const now = new Date()
  const inviteExpiresAt = new Date(
    now.getTime() + INVITE_TTL_HOURS * 60 * 60 * 1000
  ).toISOString()

  const team: Team = {
    id: teamId,
    name,
    memberIds: [userId],
    inviteToken,
    inviteExpiresAt,
    createdAt: now.toISOString(),
  }

  // 4. Persist to KV
  const kv = await getKv()
  if (!kv) {
    console.warn('[Team] KV not configured — team will not be persisted')
    // In local dev without KV, still return the team so the UI works
  } else {
    try {
      await kv.set(buildTeamKey(teamId), team, { ex: CACHE_TTL_SECONDS })

      // Also index the invite token so join can look up the team
      await kv.set(`invite:${inviteToken}`, teamId, {
        ex: INVITE_TTL_HOURS * 60 * 60,
      })
    } catch (error) {
      console.error('[Team] KV write failed:', error)
      return NextResponse.json(
        { error: 'Failed to create team — storage error' },
        { status: 500 }
      )
    }
  }

  // 5. Build the invite link
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const inviteLink = `${baseUrl}/onboarding/team?token=${inviteToken}`

  return NextResponse.json({ team, inviteLink }, { status: 201 })
}
