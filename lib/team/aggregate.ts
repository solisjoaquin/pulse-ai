import { GoogleGenerativeAI } from '@google/generative-ai'
import type { MemberActivity, TeamMember, GitHubActivity, GoogleActivity, JiraActivity } from '@/types'
import { fetchGitHubActivity } from '@/lib/sources/github'
import { fetchGoogleActivity } from '@/lib/sources/google'
import { fetchJiraActivity } from '@/lib/sources/jira'
import { cacheMemberActivity } from '@/lib/cache/team'

const GEMINI_MODEL = 'gemini-2.5-flash'
const FOCUS_SUMMARY_FALLBACK = 'Activity data available but summary unavailable.'

// ─── KV helper (same lazy-load pattern as cache modules) ─────────────────────

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

// ─── Load all TeamMember records for a team from KV ──────────────────────────

async function getTeamMembers(teamId: string): Promise<TeamMember[]> {
  try {
    const kv = await getKv()
    if (!kv) {
      console.warn('[Aggregate] KV not configured — cannot load team members')
      return []
    }

    // Team record is stored under key `team:{teamId}`
    const team = await kv.get<{ memberIds: string[] }>(`team:${teamId}`)
    if (!team || !Array.isArray(team.memberIds) || team.memberIds.length === 0) {
      console.warn(`[Aggregate] No team found or empty memberIds for teamId: ${teamId}`)
      return []
    }

    // Load each TeamMember record in parallel
    const memberResults = await Promise.allSettled(
      team.memberIds.map((userId) =>
        kv.get<TeamMember>(`member:${teamId}:${userId}`)
      )
    )

    const members: TeamMember[] = []
    for (const result of memberResults) {
      if (result.status === 'fulfilled' && result.value !== null) {
        members.push(result.value)
      } else if (result.status === 'rejected') {
        console.error('[Aggregate] Failed to load team member:', result.reason)
      }
    }

    return members
  } catch (error) {
    console.error('[Aggregate] getTeamMembers failed:', error)
    return []
  }
}

// ─── Derive structured fields from raw activity ───────────────────────────────

function deriveTouchedRepos(github: GitHubActivity | null): string[] {
  if (!github) return []

  const repos = new Set<string>()

  for (const commit of github.commits) {
    if (commit.repo) repos.add(commit.repo)
  }
  for (const pr of github.openPRs) {
    if (pr.repo) repos.add(pr.repo)
  }
  for (const pr of github.mergedPRs) {
    if (pr.repo) repos.add(pr.repo)
  }
  for (const pr of github.pendingReviews) {
    if (pr.repo) repos.add(pr.repo)
  }
  for (const issue of github.closedIssues) {
    if (issue.repo) repos.add(issue.repo)
  }

  return Array.from(repos)
}

function deriveTouchedPaths(github: GitHubActivity | null): string[] {
  if (!github || !github.modifiedFiles || github.modifiedFiles.length === 0) {
    return []
  }

  // Extract unique directory prefixes from modified file paths
  const dirs = new Set<string>()
  for (const filePath of github.modifiedFiles) {
    const lastSlash = filePath.lastIndexOf('/')
    if (lastSlash > 0) {
      dirs.add(filePath.slice(0, lastSlash + 1)) // e.g. "src/lib/auth/"
    }
  }

  return Array.from(dirs)
}

function deriveTouchedEpics(jira: JiraActivity | null): string[] {
  if (!jira) return []

  const epics = new Set<string>()

  // Use ticket keys as epic proxies — the prefix (e.g. "PULSE") groups related work
  const allTickets = [
    ...jira.inProgress,
    ...jira.movedYesterday,
    ...jira.blockers,
  ]

  for (const ticket of allTickets) {
    // Extract the project key prefix (e.g. "PULSE" from "PULSE-84")
    const match = ticket.key.match(/^([A-Z][A-Z0-9]+)-\d+$/)
    if (match) {
      epics.add(match[1])
    }
  }

  return Array.from(epics)
}

// ─── Gemini focus summary ─────────────────────────────────────────────────────

async function generateFocusSummary(
  member: TeamMember,
  github: GitHubActivity | null,
  google: GoogleActivity | null,
  jira: JiraActivity | null
): Promise<string> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    console.warn('[Aggregate] GOOGLE_API_KEY not set — using fallback focus summary')
    return FOCUS_SUMMARY_FALLBACK
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

    const activitySnapshot = {
      commits: github?.commits.map((c) => c.message).slice(0, 5) ?? [],
      openPRs: github?.openPRs.map((p) => p.title) ?? [],
      mergedPRs: github?.mergedPRs.map((p) => p.title) ?? [],
      inProgressTickets: jira?.inProgress.map((t) => t.title) ?? [],
      blockers: jira?.blockers.map((t) => t.title) ?? [],
      meetingCount: google?.events.length ?? 0,
    }

    const prompt = `You are summarizing a software engineer's work activity for their team.

Given the following activity data for ${member.name}, write exactly one sentence (maximum 15 words) describing what they are currently focused on. Be specific and concrete. Use third person ("Working on...", "Focused on..."). Do not use bullet points or lists. Return only the sentence, nothing else.

Activity data:
${JSON.stringify(activitySnapshot, null, 2)}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // Sanity check — must be a non-empty string
    if (!text || text.length === 0) {
      return FOCUS_SUMMARY_FALLBACK
    }

    // Strip any accidental quotes or markdown
    return text.replace(/^["']|["']$/g, '').trim()
  } catch (error) {
    console.error(`[Aggregate] generateFocusSummary failed for ${member.userId}:`, error)
    return FOCUS_SUMMARY_FALLBACK
  }
}

// ─── Fetch activity for a single member ──────────────────────────────────────

async function fetchMemberActivity(
  member: TeamMember,
  date: string
): Promise<MemberActivity> {
  // Fetch all three sources in parallel — failures produce null, never skip the member
  const [githubResult, googleResult, jiraResult] = await Promise.allSettled([
    member.connections.github
      ? fetchGitHubActivity(getTokenForMember(member, 'github'))
      : Promise.resolve(null),
    member.connections.google
      ? fetchGoogleActivity(getTokenForMember(member, 'google'))
      : Promise.resolve(null),
    member.connections.jira
      ? fetchJiraActivity(
          getTokenForMember(member, 'jira'),
          getJiraDomainForMember(member)
        )
      : Promise.resolve(null),
  ])

  const github: GitHubActivity | null =
    githubResult.status === 'fulfilled' ? githubResult.value : null
  const google: GoogleActivity | null =
    googleResult.status === 'fulfilled' ? googleResult.value : null
  const jira: JiraActivity | null =
    jiraResult.status === 'fulfilled' ? jiraResult.value : null

  if (githubResult.status === 'rejected') {
    console.error(`[Aggregate] GitHub fetch failed for ${member.userId}:`, githubResult.reason)
  }
  if (googleResult.status === 'rejected') {
    console.error(`[Aggregate] Google fetch failed for ${member.userId}:`, googleResult.reason)
  }
  if (jiraResult.status === 'rejected') {
    console.error(`[Aggregate] Jira fetch failed for ${member.userId}:`, jiraResult.reason)
  }

  // Derive structured fields from raw activity
  const touchedRepos = deriveTouchedRepos(github)
  const touchedPaths = deriveTouchedPaths(github)
  const touchedEpics = deriveTouchedEpics(jira)

  // Generate Gemini focus summary — falls back gracefully on error
  const focusSummary = await generateFocusSummary(member, github, google, jira)

  return {
    userId: member.userId,
    date,
    github,
    google,
    jira,
    focusSummary,
    touchedRepos,
    touchedPaths,
    touchedEpics,
  }
}

// ─── Token resolution helpers ─────────────────────────────────────────────────
//
// In the full system, per-member OAuth tokens are stored in KV alongside the
// TeamMember record. These helpers retrieve them. For the MVP the token is
// stored under `token:{teamId}:{userId}:{provider}` in KV.
// If KV is unavailable (e.g. local dev without credentials) they return an
// empty string, which will cause the source fetch to return null gracefully.

async function resolveTokenFromKv(
  teamId: string,
  userId: string,
  provider: 'github' | 'google' | 'jira'
): Promise<string> {
  try {
    const kv = await getKv()
    if (!kv) return ''
    const token = await kv.get<string>(`token:${teamId}:${userId}:${provider}`)
    return token ?? ''
  } catch {
    return ''
  }
}

// Synchronous shim used inside fetchMemberActivity — the actual async resolution
// happens via a module-level token cache populated before fetching begins.
// For simplicity in this implementation, we use a closure-captured token map.
let _tokenCache: Map<string, string> = new Map()

function getTokenForMember(
  member: TeamMember,
  provider: 'github' | 'google' | 'jira'
): string {
  return _tokenCache.get(`${member.teamId}:${member.userId}:${provider}`) ?? ''
}

function getJiraDomainForMember(member: TeamMember): string {
  return _tokenCache.get(`${member.teamId}:${member.userId}:jira_domain`) ?? ''
}

async function preloadTokens(members: TeamMember[]): Promise<void> {
  _tokenCache = new Map()

  const providers: Array<'github' | 'google' | 'jira'> = ['github', 'google', 'jira']

  await Promise.allSettled(
    members.flatMap((member) =>
      providers.map(async (provider) => {
        const token = await resolveTokenFromKv(member.teamId, member.userId, provider)
        _tokenCache.set(`${member.teamId}:${member.userId}:${provider}`, token)
      })
    )
  )

  // Also preload Jira domains
  await Promise.allSettled(
    members.map(async (member) => {
      try {
        const kv = await getKv()
        if (!kv) return
        const domain = await kv.get<string>(
          `jira_domain:${member.teamId}:${member.userId}`
        )
        if (domain) {
          _tokenCache.set(`${member.teamId}:${member.userId}:jira_domain`, domain)
        }
      } catch {
        // Silently ignore — Jira domain missing means Jira fetch returns null
      }
    })
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Aggregates activity for all members of a team on a given date.
 *
 * - Loads all TeamMember records from KV
 * - Fetches each member's GitHub, Google, and Jira activity in parallel
 * - Derives touchedRepos, touchedPaths, and touchedEpics from raw activity
 * - Calls Gemini to generate a focusSummary for each member
 * - Caches each MemberActivity in KV
 * - Returns the full MemberActivity[]
 *
 * Never throws — individual member failures are logged and produce null
 * source fields, but the member is always included in the result.
 */
export async function aggregateTeamActivity(
  teamId: string,
  date: string
): Promise<MemberActivity[]> {
  // 1. Load all team members
  const members = await getTeamMembers(teamId)
  if (members.length === 0) {
    console.warn(`[Aggregate] No members found for teamId: ${teamId}`)
    return []
  }

  // 2. Preload all OAuth tokens from KV in parallel before fetching activity
  await preloadTokens(members)

  // 3. Fetch activity for all members in parallel
  const activityResults = await Promise.allSettled(
    members.map((member) => fetchMemberActivity(member, date))
  )

  // 4. Collect results — always include the member even if something failed
  const activities: MemberActivity[] = []

  for (let i = 0; i < activityResults.length; i++) {
    const result = activityResults[i]
    const member = members[i]

    if (result.status === 'fulfilled') {
      activities.push(result.value)
    } else {
      // Unexpected top-level failure — build a minimal activity record
      console.error(
        `[Aggregate] fetchMemberActivity failed for ${member.userId}:`,
        result.reason
      )
      activities.push({
        userId: member.userId,
        date,
        github: null,
        google: null,
        jira: null,
        focusSummary: FOCUS_SUMMARY_FALLBACK,
        touchedRepos: [],
        touchedPaths: [],
        touchedEpics: [],
      })
    }
  }

  // 5. Cache all results in KV in parallel — cache failures do not block the return
  await Promise.allSettled(
    activities.map((activity) => cacheMemberActivity(teamId, activity))
  )

  return activities
}
