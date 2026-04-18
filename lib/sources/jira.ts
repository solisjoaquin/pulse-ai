import type { JiraActivity, JiraTicket } from '@/types'
import { MOCK_JIRA } from '@/lib/mock/data'

const TIMEOUT_MS = 10_000

// ─── Fetch helper with timeout ────────────────────────────────────────────────

async function jiraFetch(url: string, token: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Response shape types (Jira REST API v3) ──────────────────────────────────

interface JiraPriority {
  name: string
}

interface JiraStatus {
  name: string
}

interface JiraSprintField {
  id: number
  name: string
  state: string
}

interface JiraIssueFields {
  summary: string
  status: JiraStatus
  priority: JiraPriority | null
  customfield_10020?: JiraSprintField[] | null // sprint field (board-dependent)
}

interface JiraIssue {
  id: string
  key: string
  fields: JiraIssueFields
  self: string
}

interface JiraSearchResponse {
  issues: JiraIssue[]
  total: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapPriority(priorityName: string | undefined): 'high' | 'medium' | 'low' {
  switch (priorityName) {
    case 'Highest':
    case 'High':
      return 'high'
    case 'Medium':
      return 'medium'
    case 'Low':
    case 'Lowest':
      return 'low'
    default:
      return 'medium'
  }
}

function buildTicketUrl(domain: string, key: string): string {
  return `https://${domain}.atlassian.net/browse/${key}`
}

function toJiraTicket(issue: JiraIssue, domain: string): JiraTicket {
  return {
    key: issue.key,
    title: issue.fields.summary,
    status: issue.fields.status.name,
    priority: mapPriority(issue.fields.priority?.name),
    url: buildTicketUrl(domain, issue.key),
  }
}

function extractSprintName(issues: JiraIssue[]): string | null {
  for (const issue of issues) {
    const sprints = issue.fields.customfield_10020
    if (sprints && sprints.length > 0) {
      // Prefer the active sprint if multiple are present
      const active = sprints.find((s) => s.state === 'active')
      const sprint = active ?? sprints[0]
      if (sprint?.name) return sprint.name
    }
  }
  return null
}

async function runJql(
  baseUrl: string,
  token: string,
  jql: string
): Promise<JiraIssue[]> {
  const params = new URLSearchParams({
    jql,
    maxResults: '50',
    fields: 'summary,status,priority,customfield_10020',
  })
  const url = `${baseUrl}/search?${params.toString()}`
  const response = await jiraFetch(url, token)

  if (!response.ok) {
    throw new Error(`Jira JQL query failed (${response.status}): ${jql}`)
  }

  const data = (await response.json()) as JiraSearchResponse
  return data.issues
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchJiraActivity(
  token: string,
  domain: string
): Promise<JiraActivity | null> {
  if (process.env.DEMO_MODE === 'true') {
    return MOCK_JIRA
  }

  try {
    const baseUrl = `https://${domain}.atlassian.net/rest/api/3`

    // Run all three JQL queries in parallel
    const [inProgressResult, movedYesterdayResult, blockersResult] =
      await Promise.allSettled([
        runJql(
          baseUrl,
          token,
          'assignee = currentUser() AND status = "In Progress"'
        ),
        runJql(
          baseUrl,
          token,
          'assignee = currentUser() AND updated >= -1d'
        ),
        runJql(
          baseUrl,
          token,
          'sprint in openSprints() AND labels = "blocker" AND assignee = currentUser()'
        ),
      ])

    // Resolve in-progress tickets
    let inProgressIssues: JiraIssue[] = []
    if (inProgressResult.status === 'fulfilled') {
      inProgressIssues = inProgressResult.value
    } else {
      console.error('[Jira] Failed to fetch in-progress tickets:', inProgressResult.reason)
    }

    // Resolve moved-yesterday tickets
    let movedYesterdayIssues: JiraIssue[] = []
    if (movedYesterdayResult.status === 'fulfilled') {
      movedYesterdayIssues = movedYesterdayResult.value
    } else {
      console.error('[Jira] Failed to fetch moved-yesterday tickets:', movedYesterdayResult.reason)
    }

    // Resolve blocker tickets
    let blockerIssues: JiraIssue[] = []
    if (blockersResult.status === 'fulfilled') {
      blockerIssues = blockersResult.value
    } else {
      console.error('[Jira] Failed to fetch blocker tickets:', blockersResult.reason)
    }

    // Extract sprint name from in-progress tickets first, then fall back to
    // moved-yesterday tickets, then use the default fallback string
    const sprintName =
      extractSprintName(inProgressIssues) ??
      extractSprintName(movedYesterdayIssues) ??
      'Current Sprint'

    return {
      inProgress: inProgressIssues.map((issue) => toJiraTicket(issue, domain)),
      movedYesterday: movedYesterdayIssues.map((issue) => toJiraTicket(issue, domain)),
      blockers: blockerIssues.map((issue) => toJiraTicket(issue, domain)),
      sprintName,
    }
  } catch (error) {
    console.error('[Jira] fetchJiraActivity failed:', error)
    return null
  }
}
