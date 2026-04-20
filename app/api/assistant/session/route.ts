import { NextResponse } from 'next/server'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { auth } from '@/auth'
import { getCachedBriefing } from '@/lib/cache/briefing'
import { getAllMemberActivity, getCachedOverlaps } from '@/lib/cache/team'
import { MOCK_TEAM_MEMBERS, MOCK_ALL_ACTIVITIES, MOCK_OVERLAPS } from '@/lib/mock/data'
import type { Team, TeamMember, MemberActivity, Overlap, DailyBriefing } from '@/types'

// Read env vars at the top of the file
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID

// ─── KV helper (same lazy-load pattern used across the codebase) ──────────────

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

// ─── Find the team that a user belongs to ────────────────────────────────────
// Scans `team:*` keys and returns the first team whose memberIds includes userId.

async function findUserTeam(userId: string): Promise<Team | null> {
  try {
    const kv = await getKv()
    if (!kv) return null

    const keys = await kv.keys('team:*')
    if (keys.length === 0) return null

    const teams = await Promise.all(keys.map((key) => kv.get<Team>(key)))

    for (const team of teams) {
      if (team && team.memberIds.includes(userId)) {
        return team
      }
    }

    return null
  } catch (error) {
    console.error('[Assistant] findUserTeam failed:', error)
    return null
  }
}

// ─── Load TeamMember profiles for a list of userIds ──────────────────────────

async function getTeamMemberProfiles(
  teamId: string,
  memberIds: string[]
): Promise<Map<string, TeamMember>> {
  const profileMap = new Map<string, TeamMember>()

  try {
    const kv = await getKv()
    if (!kv) return profileMap

    const results = await Promise.allSettled(
      memberIds.map((uid) => kv.get<TeamMember>(`member:${teamId}:${uid}`))
    )

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      const uid = memberIds[i]
      if (result.status === 'fulfilled' && result.value !== null) {
        profileMap.set(uid, result.value)
      }
    }
  } catch (error) {
    console.error('[Assistant] getTeamMemberProfiles failed:', error)
  }

  return profileMap
}

// ─── Build the system prompt with all three context sections ─────────────────

function buildSystemPrompt(
  briefing: DailyBriefing | null,
  memberActivities: MemberActivity[],
  memberProfiles: Map<string, TeamMember>,
  currentUserId: string,
  overlaps: Overlap[]
): string {
  // == YOUR USER == section — full briefing content
  let userSection: string
  if (briefing?.content) {
    const c = briefing.content
    const parts: string[] = []
    if (c.summary) parts.push(c.summary)
    if (c.achievements.length > 0) {
      parts.push(`Achievements: ${c.achievements.join('. ')}`)
    }
    if (c.blockers.length > 0) {
      parts.push(`Blockers: ${c.blockers.map((b) => b.title).join('. ')}`)
    }
    if (c.pending.length > 0) {
      parts.push(`Pending: ${c.pending.map((p) => p.title).join('. ')}`)
    }
    if (c.todaySchedule.length > 0) {
      parts.push(
        `Schedule: ${c.todaySchedule
          .map((e) => {
            const time = new Date(e.start).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
            return `${e.title} at ${time}`
          })
          .join(', ')}`
      )
    }
    if (c.teamAlerts.length > 0) {
      parts.push(`Team alerts: ${c.teamAlerts.map((a) => a.message).join('. ')}`)
    }
    userSection = parts.join('\n')
  } else {
    userSection = 'No briefing available for today yet.'
  }

  // == TEAM ACTIVITY TODAY == section
  // One line per member (excluding the current user): "Name: focusSummary"
  const teamLines: string[] = []
  for (const activity of memberActivities) {
    if (activity.userId === currentUserId) continue
    const profile = memberProfiles.get(activity.userId)
    const name = profile?.name ?? activity.userId
    if (activity.focusSummary) {
      teamLines.push(`${name}: ${activity.focusSummary}`)
    }
  }
  const teamSection =
    teamLines.length > 0 ? teamLines.join('\n') : 'No team activity data available yet.'

  // == ACTIVE OVERLAPS == section — overlap reason strings only
  const overlapLines = overlaps.map((o) => o.reason)
  const overlapsSection =
    overlapLines.length > 0 ? overlapLines.join('\n') : 'No active overlaps detected.'

  return `You are Pulse, a team work assistant.

== YOUR USER ==
${userSection}

== TEAM ACTIVITY TODAY ==
${teamSection}

== ACTIVE OVERLAPS ==
${overlapsSection}

Rules:
- Answer questions about teammates based ONLY on their activity summaries
- Never reveal raw file paths, commit SHAs, or ticket IDs of others
- If asked about someone not on the team, say you don't have that info
- Keep all answers under 3 sentences unless asked for more detail`
}

// ─── Route handler ────────────────────────────────────────────────────────────

type SessionResponse = { signedUrl: string }
type ErrorResponse = { error: string }

export async function POST(): Promise<NextResponse<SessionResponse | ErrorResponse>> {
  // 1. Auth check — demo mode bypasses NextAuth session requirement
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const session = await auth()

  if (!isDemoMode && !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { error: 'ElevenLabs API key not configured' },
      { status: 500 }
    )
  }
  if (!ELEVENLABS_AGENT_ID) {
    return NextResponse.json(
      { error: 'ElevenLabs Agent ID not configured' },
      { status: 500 }
    )
  }

  const userId: string = isDemoMode ? 'demo-user' : (session!.user!.id as string)
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // 2. Load user briefing and team context in parallel
  const briefing = await getCachedBriefing(userId, today)

  let memberActivities: MemberActivity[] = []
  let overlaps: Overlap[] = []
  let memberProfiles = new Map<string, TeamMember>()

  if (isDemoMode) {
    // Use mock team data directly — no KV needed
    memberActivities = MOCK_ALL_ACTIVITIES
    overlaps = MOCK_OVERLAPS
    for (const m of MOCK_TEAM_MEMBERS) {
      memberProfiles.set(m.userId, m)
    }
  } else {
    const team = await findUserTeam(userId)
    if (team) {
      const [activities, cachedOverlaps, profiles] = await Promise.all([
        getAllMemberActivity(team.id, today),
        getCachedOverlaps(team.id, today),
        getTeamMemberProfiles(team.id, team.memberIds),
      ])
      memberActivities = activities
      overlaps = cachedOverlaps ?? []
      memberProfiles = profiles
    }
  }

  // 3. Build system prompt with all three context sections
  const systemPrompt = buildSystemPrompt(
    briefing,
    memberActivities,
    memberProfiles,
    userId,
    overlaps
  )

  // 4. Build first message from briefing summary
  const firstMessage = briefing?.content?.summary
    ? `Good morning! ${briefing.content.summary} What would you like to know more about?`
    : 'Good morning! Your briefing is being prepared. How can I help you?'

  // 5. Initialize ElevenLabs Conversational AI session
  //    Use the @elevenlabs/elevenlabs-js client for auth configuration,
  //    then call the signed URL endpoint with conversation_config_override
  //    to inject the dynamic system prompt into this session.
  try {
    const client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY })

    // getSignedUrl via the SDK — passes agentId and returns a signed WebSocket URL.
    // The conversation_config_override is sent as a request body to inject the
    // dynamic system prompt; this requires the POST variant of the endpoint.
    const response = await client.conversationalAi.conversations.getSignedUrl(
      { agentId: ELEVENLABS_AGENT_ID },
      {
        // Pass the system prompt override via the request body using the SDK's
        // requestOptions body field so the agent receives full team context.
        // @ts-expect-error — SDK types don't expose body override but the API supports it
        body: {
          agent_id: ELEVENLABS_AGENT_ID,
          conversation_config_override: {
            agent: {
              prompt: { prompt: systemPrompt },
              first_message: firstMessage,
            },
          },
        },
      }
    )

    return NextResponse.json({ signedUrl: response.signedUrl })
  } catch (error) {
    console.error('[Assistant] ElevenLabs session creation failed:', error)
    return NextResponse.json(
      { error: 'Failed to initialize voice assistant' },
      { status: 500 }
    )
  }
}
