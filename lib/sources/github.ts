import type { GitHubActivity, Commit, PullRequest, Issue } from '@/types'
import { MOCK_GITHUB } from '@/lib/mock/data'

const GITHUB_API = 'https://api.github.com'
const TIMEOUT_MS = 10_000

// ─── Fetch helper with timeout ────────────────────────────────────────────────

async function githubFetch(url: string, token: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Response shape types (GitHub REST API) ───────────────────────────────────

interface GitHubUser {
  login: string
}

interface GitHubCommitItem {
  sha: string
  commit: {
    message: string
    committer: {
      date: string
    }
  }
  repository: {
    full_name: string
  }
}

interface GitHubIssueItem {
  number: number
  title: string
  html_url: string
  created_at: string
  pull_request?: {
    merged_at: string | null
  }
  user: {
    login: string
  }
  repository_url: string
}

interface GitHubSearchCommitsResponse {
  items: GitHubCommitItem[]
}

interface GitHubSearchIssuesResponse {
  items: GitHubIssueItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function repoFromUrl(repositoryUrl: string): string {
  // repository_url is like https://api.github.com/repos/owner/repo
  return repositoryUrl.replace(`${GITHUB_API}/repos/`, '')
}

function daysOpen(createdAt: string): number {
  const created = new Date(createdAt).getTime()
  const now = Date.now()
  return Math.floor((now - created) / (1000 * 60 * 60 * 24))
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchGitHubActivity(
  token: string
): Promise<GitHubActivity | null> {
  if (process.env.DEMO_MODE === 'true') {
    return MOCK_GITHUB
  }

  try {
    // 1. Get authenticated user
    const userResponse = await githubFetch(`${GITHUB_API}/user`, token)
    if (!userResponse.ok) {
      console.error(
        '[GitHub] Failed to fetch authenticated user:',
        userResponse.status,
        userResponse.statusText
      )
      return null
    }
    const user = (await userResponse.json()) as GitHubUser
    const username = user.login

    // 2. Compute yesterday date (YYYY-MM-DD)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]

    // 3. Fetch all 5 endpoints in parallel
    const [
      commitsResult,
      openPRsResult,
      pendingReviewsResult,
      closedIssuesResult,
      mergedPRsResult,
    ] = await Promise.allSettled([
      githubFetch(
        `${GITHUB_API}/search/commits?q=author:${username}+committer-date:>${yesterday}`,
        token
      ),
      githubFetch(
        `${GITHUB_API}/search/issues?q=author:${username}+type:pr+state:open`,
        token
      ),
      githubFetch(
        `${GITHUB_API}/search/issues?q=review-requested:${username}+type:pr+state:open`,
        token
      ),
      githubFetch(
        `${GITHUB_API}/search/issues?q=assignee:${username}+type:issue+state:closed+closed:>${yesterday}`,
        token
      ),
      githubFetch(
        `${GITHUB_API}/search/issues?q=author:${username}+type:pr+is:merged+merged:>${yesterday}`,
        token
      ),
    ])

    // 4. Map responses to typed objects

    // Commits
    let commits: Commit[] = []
    if (commitsResult.status === 'fulfilled' && commitsResult.value.ok) {
      const data =
        (await commitsResult.value.json()) as GitHubSearchCommitsResponse
      commits = data.items.map((item) => ({
        sha: item.sha,
        message: item.commit.message.split('\n')[0], // first line only
        repo: item.repository.full_name,
        timestamp: item.commit.committer.date,
      }))
    } else {
      const reason =
        commitsResult.status === 'rejected'
          ? commitsResult.reason
          : `HTTP ${commitsResult.value.status}`
      console.error('[GitHub] Failed to fetch commits:', reason)
    }

    // Open PRs authored
    let openPRs: PullRequest[] = []
    if (openPRsResult.status === 'fulfilled' && openPRsResult.value.ok) {
      const data =
        (await openPRsResult.value.json()) as GitHubSearchIssuesResponse
      openPRs = data.items.map((item) => ({
        number: item.number,
        title: item.title,
        repo: repoFromUrl(item.repository_url),
        url: item.html_url,
        daysOpen: daysOpen(item.created_at),
      }))
    } else {
      const reason =
        openPRsResult.status === 'rejected'
          ? openPRsResult.reason
          : `HTTP ${openPRsResult.value.status}`
      console.error('[GitHub] Failed to fetch open PRs:', reason)
    }

    // Pending reviews
    let pendingReviews: PullRequest[] = []
    if (
      pendingReviewsResult.status === 'fulfilled' &&
      pendingReviewsResult.value.ok
    ) {
      const data =
        (await pendingReviewsResult.value.json()) as GitHubSearchIssuesResponse
      pendingReviews = data.items.map((item) => ({
        number: item.number,
        title: item.title,
        repo: repoFromUrl(item.repository_url),
        url: item.html_url,
        daysOpen: daysOpen(item.created_at),
        author: item.user.login,
      }))
    } else {
      const reason =
        pendingReviewsResult.status === 'rejected'
          ? pendingReviewsResult.reason
          : `HTTP ${pendingReviewsResult.value.status}`
      console.error('[GitHub] Failed to fetch pending reviews:', reason)
    }

    // Closed issues
    let closedIssues: Issue[] = []
    if (
      closedIssuesResult.status === 'fulfilled' &&
      closedIssuesResult.value.ok
    ) {
      const data =
        (await closedIssuesResult.value.json()) as GitHubSearchIssuesResponse
      closedIssues = data.items.map((item) => ({
        number: item.number,
        title: item.title,
        repo: repoFromUrl(item.repository_url),
        url: item.html_url,
      }))
    } else {
      const reason =
        closedIssuesResult.status === 'rejected'
          ? closedIssuesResult.reason
          : `HTTP ${closedIssuesResult.value.status}`
      console.error('[GitHub] Failed to fetch closed issues:', reason)
    }

    // Merged PRs
    let mergedPRs: PullRequest[] = []
    if (mergedPRsResult.status === 'fulfilled' && mergedPRsResult.value.ok) {
      const data =
        (await mergedPRsResult.value.json()) as GitHubSearchIssuesResponse
      mergedPRs = data.items.map((item) => ({
        number: item.number,
        title: item.title,
        repo: repoFromUrl(item.repository_url),
        url: item.html_url,
        daysOpen: daysOpen(item.created_at),
      }))
    } else {
      const reason =
        mergedPRsResult.status === 'rejected'
          ? mergedPRsResult.reason
          : `HTTP ${mergedPRsResult.value.status}`
      console.error('[GitHub] Failed to fetch merged PRs:', reason)
    }

    // 5. Return full typed GitHubActivity object
    // Note: modifiedFiles requires per-commit detail fetches which are not
    // performed here for performance reasons. The field is populated by
    // aggregateTeamActivity when building MemberActivity for team overlap detection.
    return {
      commits,
      openPRs,
      pendingReviews,
      closedIssues,
      mergedPRs,
      modifiedFiles: [],
    }
  } catch (error) {
    console.error('[GitHub] fetchGitHubActivity failed:', error)
    return null
  }
}
