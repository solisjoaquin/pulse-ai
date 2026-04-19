import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/auth'
import type { Team, TeamMember, Overlap } from '@/types'
import { getAllMemberActivity, getCachedOverlaps } from '@/lib/cache/team'
import { MOCK_TEAM_MEMBERS, MOCK_ALL_ACTIVITIES, MOCK_OVERLAPS } from '@/lib/mock/data'
import OverlapAlert from '@/components/team/OverlapAlert'
import TeamFeed from '@/components/team/TeamFeed'
import TeamTimeline from '@/components/team/TeamTimeline'

// ── KV helper ────────────────────────────────────────────────────────────────

async function getKv(): Promise<import('@vercel/kv').VercelKV | null> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null
  try {
    const { kv } = await import('@vercel/kv')
    return kv
  } catch {
    return null
  }
}

// ── Data fetching helpers ─────────────────────────────────────────────────────

/**
 * Scan `team:*` keys to find the team the given user belongs to.
 * Returns the teamId string or null if not found.
 */
async function findTeamIdForUser(userId: string): Promise<string | null> {
  try {
    const kv = await getKv()
    if (!kv) return null

    const keys = await kv.keys('team:*')
    if (keys.length === 0) return null

    const teams = await Promise.all(keys.map((key) => kv.get<Team>(key)))

    for (const team of teams) {
      if (team !== null && team.memberIds.includes(userId)) {
        return team.id
      }
    }

    return null
  } catch (error) {
    console.error('[TeamPage] findTeamIdForUser failed:', error)
    return null
  }
}

/**
 * Fetch all TeamMember profiles for the given memberIds from KV.
 */
async function getTeamMembers(memberIds: string[]): Promise<TeamMember[]> {
  if (memberIds.length === 0) return []

  try {
    const kv = await getKv()
    if (!kv) return []

    const results = await Promise.all(
      memberIds.map((id) => kv.get<TeamMember>(`member:${id}`))
    )

    return results.filter((m): m is TeamMember => m !== null)
  } catch (error) {
    console.error('[TeamPage] getTeamMembers failed:', error)
    return []
  }
}

/**
 * Fetch the Team record from KV by teamId.
 */
async function getTeam(teamId: string): Promise<Team | null> {
  try {
    const kv = await getKv()
    if (!kv) return null

    return await kv.get<Team>(`team:${teamId}`)
  } catch (error) {
    console.error('[TeamPage] getTeam failed:', error)
    return null
  }
}

// ── Overlap sorting ───────────────────────────────────────────────────────────

const OVERLAP_ORDER: Record<Overlap['type'], number> = {
  conflict: 0,
  synergy: 1,
  awareness: 2,
}

function sortOverlaps(overlaps: Overlap[]): Overlap[] {
  return [...overlaps].sort(
    (a, b) => OVERLAP_ORDER[a.type] - OVERLAP_ORDER[b.type]
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TeamDashboardPage(): Promise<React.ReactElement> {
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const session = await auth()

  if (!isDemoMode && !session?.user) {
    redirect('/')
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // In demo mode, serve mock team data directly — no KV needed
  let members: TeamMember[]
  let activities: Awaited<ReturnType<typeof getAllMemberActivity>>
  let overlaps: Overlap[]
  let teamId: string | null

  if (isDemoMode) {
    teamId = 'demo-team'
    members = MOCK_TEAM_MEMBERS
    activities = MOCK_ALL_ACTIVITIES
    overlaps = sortOverlaps(MOCK_OVERLAPS)
  } else {
    const userId = session!.user!.id as string

    // Find which team this user belongs to
    teamId = await findTeamIdForUser(userId)

    // Fetch all data in parallel once we have the teamId
    const [team, rawActivities, rawOverlaps] = await Promise.all([
      teamId ? getTeam(teamId) : Promise.resolve(null),
      teamId ? getAllMemberActivity(teamId, today) : Promise.resolve([]),
      teamId ? getCachedOverlaps(teamId, today) : Promise.resolve(null),
    ])

    const memberIds = team?.memberIds ?? []
    members = await getTeamMembers(memberIds)
    activities = rawActivities
    overlaps = sortOverlaps(rawOverlaps ?? [])
  }

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const hasOverlaps = overlaps.length > 0

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#1D9E75', flexShrink: 0 }}
            aria-hidden="true"
          />
          <span style={{ fontSize: '17px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Pulse</span>
        </div>

        {/* Nav tabs */}
        <nav style={{ display: 'flex', gap: '4px' }} aria-label="Dashboard navigation">
          <Link
            href="/dashboard"
            style={{
              padding: '5px 14px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              background: 'none',
              color: 'var(--color-text-secondary)',
              border: '0.5px solid var(--color-border-tertiary)',
            }}
          >
            My briefing
          </Link>
          <Link
            href="/dashboard/team"
            style={{
              padding: '5px 14px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              background: '#1D9E75',
              color: '#fff',
              border: 'none',
            }}
          >
            Team
          </Link>
        </nav>

        {/* Date */}
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{formattedDate}</p>
      </header>

      {/* No team state */}
      {!teamId && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
            border: '1px dashed var(--color-border-tertiary)',
            background: 'var(--color-background-secondary)',
            padding: '5rem 1rem',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              You are not part of a team yet
            </p>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Create or join a team from{' '}
              <a href="/onboarding/team" style={{ color: '#1D9E75', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                onboarding
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {teamId && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* ── Section 1: Overlaps ─────────────────────────────────────── */}
          <section aria-labelledby="overlaps-heading">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <p
                id="overlaps-heading"
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-text-tertiary)',
                  margin: 0,
                }}
              >
                Active Overlaps
              </p>
              {hasOverlaps && (
                <span
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-tertiary)',
                    background: 'var(--color-background-secondary)',
                    padding: '2px 8px',
                    borderRadius: '100px',
                    border: '0.5px solid var(--color-border-tertiary)',
                  }}
                >
                  {overlaps.length} detected today
                </span>
              )}
            </div>

            {!hasOverlaps ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  border: '1px dashed var(--color-border-tertiary)',
                  background: 'var(--color-background-secondary)',
                  padding: '3rem 1rem',
                }}
              >
                <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>No active overlaps detected today</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {overlaps.map((overlap) => (
                  <OverlapAlert key={overlap.id} overlap={overlap} members={members} />
                ))}
              </div>
            )}
          </section>

          {/* ── Section 2: Team feed ────────────────────────────────────── */}
          <section aria-labelledby="team-feed-heading">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <p
                id="team-feed-heading"
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-text-tertiary)',
                  margin: 0,
                }}
              >
                Team · {members.length} member{members.length !== 1 ? 's' : ''} active today
              </p>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-tertiary)',
                  background: 'var(--color-background-secondary)',
                  padding: '2px 8px',
                  borderRadius: '100px',
                  border: '0.5px solid var(--color-border-tertiary)',
                }}
              >
                updated just now
              </span>
            </div>
            <TeamFeed members={members} activities={activities} />
          </section>

          {/* ── Section 3: Timeline ─────────────────────────────────────── */}
          <section aria-labelledby="timeline-heading">
            <TeamTimeline activities={activities} />
          </section>
        </div>
      )}
    </div>
  )
}
