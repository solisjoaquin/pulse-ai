import { describe, it, expect } from 'vitest'
import { detectStructuralOverlaps } from './overlaps'
import type { MemberActivity, GitHubActivity } from '@/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeActivity(
  userId: string,
  overrides: Partial<MemberActivity> = {}
): MemberActivity {
  return {
    userId,
    date: '2024-01-15',
    github: null,
    google: null,
    jira: null,
    focusSummary: `${userId} is working on something`,
    touchedRepos: [],
    touchedPaths: [],
    touchedEpics: [],
    ...overrides,
  }
}

function makeGitHub(overrides: Partial<GitHubActivity> = {}): GitHubActivity {
  return {
    commits: [],
    openPRs: [],
    pendingReviews: [],
    closedIssues: [],
    mergedPRs: [],
    modifiedFiles: [],
    ...overrides,
  }
}

const openPR = { number: 1, title: 'My PR', repo: 'pulse-app', url: 'https://github.com', daysOpen: 1 }

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('detectStructuralOverlaps — edge cases', () => {
  it('returns empty array for zero members', () => {
    expect(detectStructuralOverlaps([])).toEqual([])
  })

  it('returns empty array for a single-member team', () => {
    const activities = [makeActivity('alice')]
    expect(detectStructuralOverlaps(activities)).toEqual([])
  })

  it('returns empty array when two members have no shared activity', () => {
    const activities = [
      makeActivity('alice', { touchedRepos: ['repo-a'], touchedPaths: ['src/a/'] }),
      makeActivity('bob',   { touchedRepos: ['repo-b'], touchedPaths: ['src/b/'] }),
    ]
    expect(detectStructuralOverlaps(activities)).toEqual([])
  })
})

// ─── CONFLICT detection ───────────────────────────────────────────────────────

describe('detectStructuralOverlaps — CONFLICT', () => {
  it('detects a conflict when two members modify the same file and both have open PRs', () => {
    const activities = [
      makeActivity('alice', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/auth/index.ts', 'src/lib/auth/utils.ts'],
          openPRs: [openPR],
        }),
      }),
      makeActivity('bob', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/auth/index.ts'],
          openPRs: [openPR],
        }),
      }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].type).toBe('conflict')
    expect(overlaps[0].memberIds).toEqual(expect.arrayContaining(['alice', 'bob']))
    expect(overlaps[0].id).toBeTruthy()
    expect(overlaps[0].detectedAt).toBeTruthy()
  })

  it('does NOT detect a conflict when only one member has an open PR', () => {
    const activities = [
      makeActivity('alice', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/auth/index.ts'],
          openPRs: [openPR],
        }),
      }),
      makeActivity('bob', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/auth/index.ts'],
          openPRs: [], // no open PRs
        }),
      }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    expect(overlaps.every((o) => o.type !== 'conflict')).toBe(true)
  })

  it('does NOT detect a conflict when files differ', () => {
    const activities = [
      makeActivity('alice', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/auth/index.ts'],
          openPRs: [openPR],
        }),
      }),
      makeActivity('bob', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/cache/briefing.ts'],
          openPRs: [openPR],
        }),
      }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    expect(overlaps.every((o) => o.type !== 'conflict')).toBe(true)
  })

  it('conflict reason names the shared file', () => {
    const activities = [
      makeActivity('alice', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/auth/index.ts'],
          openPRs: [openPR],
        }),
      }),
      makeActivity('bob', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/auth/index.ts'],
          openPRs: [openPR],
        }),
      }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    expect(overlaps[0].reason).toContain('src/lib/auth/index.ts')
  })
})

// ─── AWARENESS — repo ─────────────────────────────────────────────────────────

describe('detectStructuralOverlaps — AWARENESS (repo)', () => {
  it('detects awareness when two members share a repo', () => {
    const activities = [
      makeActivity('alice', { touchedRepos: ['pulse-app', 'pulse-infra'] }),
      makeActivity('bob',   { touchedRepos: ['pulse-app'] }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].type).toBe('awareness')
    expect(overlaps[0].repos).toContain('pulse-app')
  })

  it('creates only ONE awareness overlap per pair even when multiple repos are shared', () => {
    const activities = [
      makeActivity('alice', { touchedRepos: ['repo-a', 'repo-b', 'repo-c'] }),
      makeActivity('bob',   { touchedRepos: ['repo-a', 'repo-b'] }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].repos).toEqual(expect.arrayContaining(['repo-a', 'repo-b']))
  })

  it('does NOT create awareness for unrelated repos', () => {
    const activities = [
      makeActivity('alice', { touchedRepos: ['repo-a'] }),
      makeActivity('bob',   { touchedRepos: ['repo-b'] }),
    ]

    expect(detectStructuralOverlaps(activities)).toHaveLength(0)
  })
})

// ─── AWARENESS — path ─────────────────────────────────────────────────────────

describe('detectStructuralOverlaps — AWARENESS (path)', () => {
  it('detects awareness when two members share a directory prefix', () => {
    const activities = [
      makeActivity('alice', { touchedPaths: ['src/lib/auth/'] }),
      makeActivity('bob',   { touchedPaths: ['src/lib/auth/'] }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].type).toBe('awareness')
    expect(overlaps[0].paths).toContain('src/lib/auth/')
  })

  it('detects awareness when one path is a sub-directory of the other', () => {
    const activities = [
      makeActivity('alice', { touchedPaths: ['src/lib/auth/'] }),
      makeActivity('bob',   { touchedPaths: ['src/lib/auth/utils/'] }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].type).toBe('awareness')
  })

  it('does NOT detect awareness for unrelated paths', () => {
    const activities = [
      makeActivity('alice', { touchedPaths: ['src/lib/auth/'] }),
      makeActivity('bob',   { touchedPaths: ['src/components/dashboard/'] }),
    ]

    expect(detectStructuralOverlaps(activities)).toHaveLength(0)
  })

  it('does NOT match paths that share a prefix string but are different directories', () => {
    // "src/lib/auth/" should NOT match "src/lib/auth-v2/"
    const activities = [
      makeActivity('alice', { touchedPaths: ['src/lib/auth/'] }),
      makeActivity('bob',   { touchedPaths: ['src/lib/auth-v2/'] }),
    ]

    expect(detectStructuralOverlaps(activities)).toHaveLength(0)
  })
})

// ─── Priority: CONFLICT suppresses AWARENESS ─────────────────────────────────

describe('detectStructuralOverlaps — CONFLICT takes priority over AWARENESS', () => {
  it('does not add an AWARENESS overlap for a pair that already has a CONFLICT', () => {
    const activities = [
      makeActivity('alice', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/auth/index.ts'],
          openPRs: [openPR],
        }),
        touchedRepos: ['pulse-app'],
        touchedPaths: ['src/lib/auth/'],
      }),
      makeActivity('bob', {
        github: makeGitHub({
          modifiedFiles: ['src/lib/auth/index.ts'],
          openPRs: [openPR],
        }),
        touchedRepos: ['pulse-app'],
        touchedPaths: ['src/lib/auth/'],
      }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    // Should have exactly one overlap (CONFLICT), not two
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].type).toBe('conflict')
  })
})

// ─── Multi-member teams ───────────────────────────────────────────────────────

describe('detectStructuralOverlaps — multi-member teams', () => {
  it('detects overlaps across all pairs in a 3-member team', () => {
    const activities = [
      makeActivity('alice', { touchedRepos: ['pulse-app'] }),
      makeActivity('bob',   { touchedRepos: ['pulse-app'] }),
      makeActivity('carol', { touchedRepos: ['pulse-app'] }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    // 3 pairs: alice-bob, alice-carol, bob-carol
    expect(overlaps).toHaveLength(3)
    expect(overlaps.every((o) => o.type === 'awareness')).toBe(true)
  })

  it('assigns unique IDs to every overlap', () => {
    const activities = [
      makeActivity('alice', { touchedRepos: ['pulse-app'] }),
      makeActivity('bob',   { touchedRepos: ['pulse-app'] }),
      makeActivity('carol', { touchedRepos: ['pulse-app'] }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    const ids = overlaps.map((o) => o.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })
})

// ─── Overlap shape ────────────────────────────────────────────────────────────

describe('detectStructuralOverlaps — Overlap shape', () => {
  it('every returned Overlap has all required fields', () => {
    const activities = [
      makeActivity('alice', { touchedRepos: ['pulse-app'] }),
      makeActivity('bob',   { touchedRepos: ['pulse-app'] }),
    ]

    const overlaps = detectStructuralOverlaps(activities)
    expect(overlaps).toHaveLength(1)

    const o = overlaps[0]
    expect(typeof o.id).toBe('string')
    expect(o.id.length).toBeGreaterThan(0)
    expect(['conflict', 'synergy', 'awareness']).toContain(o.type)
    expect(Array.isArray(o.memberIds)).toBe(true)
    expect(o.memberIds).toHaveLength(2)
    expect(typeof o.reason).toBe('string')
    expect(typeof o.detail).toBe('string')
    expect(Array.isArray(o.repos)).toBe(true)
    expect(Array.isArray(o.paths)).toBe(true)
    expect(typeof o.detectedAt).toBe('string')
    // detectedAt should be a valid ISO timestamp
    expect(() => new Date(o.detectedAt)).not.toThrow()
  })
})
