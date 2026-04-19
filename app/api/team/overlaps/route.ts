import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAllMemberActivity, cacheOverlaps } from '@/lib/cache/team'
import { detectStructuralOverlaps } from '@/lib/team/overlaps'
import { analyzeSemanticOverlaps } from '@/lib/ai/analyzeOverlaps'
import type { Overlap } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type OverlapsRequest = { teamId: string }
type OverlapsResponse = { overlaps: Overlap[] }
type ErrorResponse = { error: string }

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Returns a canonical key for a member pair + overlap type.
 * Member order is normalised so (A,B) and (B,A) produce the same key.
 */
function overlapKey(memberIds: [string, string], type: Overlap['type']): string {
  const [a, b] = memberIds
  const sorted = a < b ? `${a}::${b}` : `${b}::${a}`
  return `${sorted}::${type}`
}

/**
 * Merges structural and semantic overlaps, keeping the first occurrence
 * when two overlaps share the same member pair AND the same type.
 */
function deduplicateOverlaps(overlaps: Overlap[]): Overlap[] {
  const seen = new Set<string>()
  const result: Overlap[] = []

  for (const overlap of overlaps) {
    const key = overlapKey(overlap.memberIds, overlap.type)
    if (!seen.has(key)) {
      seen.add(key)
      result.push(overlap)
    }
  }

  return result
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<OverlapsResponse | ErrorResponse>> {
  // 1. Auth check — valid session required
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse and validate request body
  let body: OverlapsRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const teamId = body?.teamId?.trim()
  if (!teamId) {
    return NextResponse.json({ error: 'teamId is required' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // 3. Load today's member activity from KV
  const activities = await getAllMemberActivity(teamId, today)

  // 4. Pass 1 — structural overlap detection (deterministic, no AI)
  const structuralOverlaps = detectStructuralOverlaps(activities)

  // 5. Pass 2 — semantic overlap detection via Gemini
  const semanticOverlaps = await analyzeSemanticOverlaps(activities)

  // 6. Merge and deduplicate by member pair + type (first occurrence wins)
  const combined = deduplicateOverlaps([...structuralOverlaps, ...semanticOverlaps])

  // 7. Cache the combined overlaps in KV
  await cacheOverlaps(teamId, today, combined)

  // 8. Return the result
  return NextResponse.json({ overlaps: combined })
}
