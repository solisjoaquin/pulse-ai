import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import type { Team, TeamMember, Overlap } from '@/types'
import { getAllMemberActivity, getCachedOverlaps } from '@/lib/cache/team'
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
  const session = await auth()

  if (!session?.user) {
    redirect('/')
  }

  const userId = session.user.id as string
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Find which team this user belongs to
  const teamId = await findTeamIdForUser(userId)

  // Fetch all data in parallel once we have the teamId
  const [team, activities, rawOverlaps] = await Promise.all([
    teamId ? getTeam(teamId) : Promise.resolve(null),
    teamId ? getAllMemberActivity(teamId, today) : Promise.resolve([]),
    teamId ? getCachedOverlaps(teamId, today) : Promise.resolve(null),
  ])

  const memberIds = team?.memberIds ?? []
  const members = await getTeamMembers(memberIds)
  const overlaps = sortOverlaps(rawOverlaps ?? [])

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const hasOverlaps = overlaps.length > 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* Pulse logo dot */}
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#1D9E75]"
            aria-hidden="true"
          />
          <h1 className="text-lg font-semibold text-gray-900">
            {team?.name ?? 'Team'} Intelligence
          </h1>
        </div>
        <p className="text-sm text-gray-500">{formattedDate}</p>
      </header>

      {/* No team state */}
      {!teamId && (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-20">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">You are not part of a team yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Create or join a team from{' '}
              <a href="/onboarding/team" className="text-[#1D9E75] underline underline-offset-2">
                onboarding
              </a>
              .
            </p>
          </div>
        </div>
      )}

      {teamId && (
        <div className="flex flex-col gap-10">
          {/* ── Section 1: Overlaps ─────────────────────────────────────── */}
          <section aria-labelledby="overlaps-heading">
            <h2
              id="overlaps-heading"
              className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500"
            >
              Active Overlaps
            </h2>

            {!hasOverlaps ? (
              <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12">
                <p className="text-sm text-gray-500">No active overlaps detected today</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {overlaps.map((overlap) => (
                  <OverlapAlert
                    key={overlap.id}
                    overlap={overlap}
                    members={members}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ── Section 2: Team feed ────────────────────────────────────── */}
          <section aria-labelledby="team-feed-heading">
            <h2
              id="team-feed-heading"
              className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500"
            >
              Team Activity
            </h2>
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
