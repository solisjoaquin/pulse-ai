import type { MemberActivity, Overlap } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if `filePath` is inside `dirPrefix`.
 * e.g. "src/lib/auth/" matches "src/lib/auth/utils.ts"
 *      "src/lib/auth/" does NOT match "src/lib/auth-v2/index.ts"
 */
function isUnderPrefix(dirPrefix: string, filePath: string): boolean {
  return filePath.startsWith(dirPrefix)
}

/**
 * Returns true if two directory prefixes overlap — i.e. one is a prefix of
 * the other or they are equal.
 * e.g. "src/lib/auth/" and "src/lib/auth/utils/" → true
 *      "src/lib/auth/" and "src/lib/cache/"      → false
 */
function prefixesOverlap(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a)
}

/** Canonical pair key so (A,B) and (B,A) map to the same string. */
function pairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}::${idB}` : `${idB}::${idA}`
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Pass 1 — Structural overlap detection (no AI).
 *
 * Detects:
 *   CONFLICT  — same file path in both members' modifiedFiles AND both have open PRs
 *   AWARENESS — same repo in both members' touchedRepos  (repo-level)
 *             — overlapping directory prefix in both members' touchedPaths (path-level)
 *
 * Rules:
 *   - Single-member team → returns []
 *   - One Overlap per member pair (not one per shared repo/path)
 *   - CONFLICT takes priority: if a pair already has a CONFLICT, no AWARENESS is added
 *   - Deduplication: repo and path awareness are merged into a single AWARENESS per pair
 */
export function detectStructuralOverlaps(activities: MemberActivity[]): Overlap[] {
  // Edge case: need at least two members to have an overlap
  if (activities.length < 2) {
    return []
  }

  const now = new Date().toISOString()
  const overlaps: Overlap[] = []

  // Track which pairs already have a CONFLICT so we skip AWARENESS for them
  const conflictPairs = new Set<string>()
  // Track which pairs already have an AWARENESS so we don't duplicate
  const awarenessPairs = new Set<string>()

  // ── Pass A: CONFLICT detection ─────────────────────────────────────────────
  for (let i = 0; i < activities.length; i++) {
    for (let j = i + 1; j < activities.length; j++) {
      const a = activities[i]
      const b = activities[j]

      const aFiles = a.github?.modifiedFiles ?? []
      const bFiles = b.github?.modifiedFiles ?? []
      const aHasOpenPRs = (a.github?.openPRs.length ?? 0) > 0
      const bHasOpenPRs = (b.github?.openPRs.length ?? 0) > 0

      // CONFLICT requires: shared file AND both have open PRs
      if (!aHasOpenPRs || !bHasOpenPRs) continue
      if (aFiles.length === 0 || bFiles.length === 0) continue

      const bFileSet = new Set(bFiles)
      const sharedFiles = aFiles.filter((f) => bFileSet.has(f))

      if (sharedFiles.length === 0) continue

      const key = pairKey(a.userId, b.userId)
      conflictPairs.add(key)

      // Collect repos and paths from the shared files for context
      const sharedRepos = Array.from(
        new Set([
          ...a.github!.openPRs.map((pr) => pr.repo),
          ...b.github!.openPRs.map((pr) => pr.repo),
        ])
      )

      const sharedDirs = Array.from(
        new Set(
          sharedFiles.map((f) => {
            const lastSlash = f.lastIndexOf('/')
            return lastSlash > 0 ? f.slice(0, lastSlash + 1) : ''
          }).filter(Boolean)
        )
      )

      const fileList = sharedFiles.slice(0, 3).join(', ')
      const reason =
        sharedFiles.length === 1
          ? `Both modifying ${sharedFiles[0]}`
          : `Both modifying ${sharedFiles.length} shared files including ${sharedFiles[0]}`

      overlaps.push({
        id: crypto.randomUUID(),
        type: 'conflict',
        memberIds: [a.userId, b.userId],
        reason,
        detail: `Shared modified files: ${fileList}${sharedFiles.length > 3 ? ` and ${sharedFiles.length - 3} more` : ''}. Both members have open pull requests.`,
        repos: sharedRepos,
        paths: sharedDirs,
        detectedAt: now,
      })
    }
  }

  // ── Pass B: AWARENESS detection ────────────────────────────────────────────
  for (let i = 0; i < activities.length; i++) {
    for (let j = i + 1; j < activities.length; j++) {
      const a = activities[i]
      const b = activities[j]
      const key = pairKey(a.userId, b.userId)

      // CONFLICT takes priority — skip AWARENESS for this pair
      if (conflictPairs.has(key)) continue
      // Already have an AWARENESS for this pair — skip
      if (awarenessPairs.has(key)) continue

      // ── Repo overlap ──────────────────────────────────────────────────────
      const aRepos = new Set(a.touchedRepos)
      const sharedRepos = b.touchedRepos.filter((r) => aRepos.has(r))

      // ── Path overlap ──────────────────────────────────────────────────────
      const sharedPaths: string[] = []
      for (const aPath of a.touchedPaths) {
        for (const bPath of b.touchedPaths) {
          if (prefixesOverlap(aPath, bPath)) {
            // Record the more specific (longer) prefix as the shared path
            const representative = aPath.length >= bPath.length ? aPath : bPath
            if (!sharedPaths.includes(representative)) {
              sharedPaths.push(representative)
            }
          }
        }
      }

      if (sharedRepos.length === 0 && sharedPaths.length === 0) continue

      awarenessPairs.add(key)

      // Build a human-readable reason
      let reason: string
      let detail: string

      if (sharedPaths.length > 0 && sharedRepos.length > 0) {
        reason = `Both working in ${sharedPaths[0]}`
        detail = `Shared repos: ${sharedRepos.join(', ')}. Shared paths: ${sharedPaths.join(', ')}.`
      } else if (sharedPaths.length > 0) {
        reason =
          sharedPaths.length === 1
            ? `Both working in ${sharedPaths[0]}`
            : `Both working in ${sharedPaths.length} overlapping directories including ${sharedPaths[0]}`
        detail = `Overlapping paths: ${sharedPaths.join(', ')}.`
      } else {
        reason =
          sharedRepos.length === 1
            ? `Both active in the ${sharedRepos[0]} repo`
            : `Both active in ${sharedRepos.length} shared repos: ${sharedRepos.join(', ')}`
        detail = `Shared repos: ${sharedRepos.join(', ')}.`
      }

      overlaps.push({
        id: crypto.randomUUID(),
        type: 'awareness',
        memberIds: [a.userId, b.userId],
        reason,
        detail,
        repos: sharedRepos,
        paths: sharedPaths,
        detectedAt: now,
      })
    }
  }

  return overlaps
}
