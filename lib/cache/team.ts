import type { MemberActivity, Overlap } from '@/types'

const CACHE_TTL_SECONDS = 86_400 // 24 hours

function buildActivityKey(teamId: string, userId: string, date: string): string {
  return `activity:${teamId}:${userId}:${date}`
}

function buildOverlapsKey(teamId: string, date: string): string {
  return `overlaps:${teamId}:${date}`
}

// Lazily import kv only when KV credentials are present.
// This prevents @vercel/kv from throwing at module load time
// when KV_REST_API_URL / KV_REST_API_TOKEN are not configured (e.g. local dev).
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

export async function getMemberActivity(
  teamId: string,
  userId: string,
  date: string
): Promise<MemberActivity | null> {
  try {
    const kv = await getKv()
    if (!kv) return null

    const key = buildActivityKey(teamId, userId, date)
    const cached = await kv.get<MemberActivity>(key)
    return cached ?? null
  } catch (error) {
    console.error('[Cache] getMemberActivity failed:', error)
    return null
  }
}

export async function cacheMemberActivity(
  teamId: string,
  activity: MemberActivity
): Promise<void> {
  try {
    const kv = await getKv()
    if (!kv) {
      console.warn('[Cache] KV not configured — skipping cache write')
      return
    }

    const key = buildActivityKey(teamId, activity.userId, activity.date)
    await kv.set(key, activity, { ex: CACHE_TTL_SECONDS })
  } catch (error) {
    console.error('[Cache] cacheMemberActivity failed:', error)
    // Don't throw — caching failure should not break the pipeline
  }
}

export async function getAllMemberActivity(
  teamId: string,
  date: string
): Promise<MemberActivity[]> {
  try {
    const kv = await getKv()
    if (!kv) return []

    // Scan for all keys matching activity:{teamId}:*:{date}
    const pattern = `activity:${teamId}:*:${date}`
    const keys = await kv.keys(pattern)
    if (keys.length === 0) return []

    // Fetch all matching records in parallel
    const results = await Promise.all(
      keys.map((key) => kv.get<MemberActivity>(key))
    )

    // Filter out any null/undefined values
    return results.filter((activity): activity is MemberActivity => activity !== null)
  } catch (error) {
    console.error('[Cache] getAllMemberActivity failed:', error)
    return []
  }
}

export async function getCachedOverlaps(
  teamId: string,
  date: string
): Promise<Overlap[] | null> {
  try {
    const kv = await getKv()
    if (!kv) return null

    const key = buildOverlapsKey(teamId, date)
    const cached = await kv.get<Overlap[]>(key)
    return cached ?? null
  } catch (error) {
    console.error('[Cache] getCachedOverlaps failed:', error)
    return null
  }
}

export async function cacheOverlaps(
  teamId: string,
  date: string,
  overlaps: Overlap[]
): Promise<void> {
  try {
    const kv = await getKv()
    if (!kv) {
      console.warn('[Cache] KV not configured — skipping cache write')
      return
    }

    const key = buildOverlapsKey(teamId, date)
    await kv.set(key, overlaps, { ex: CACHE_TTL_SECONDS })
  } catch (error) {
    console.error('[Cache] cacheOverlaps failed:', error)
    // Don't throw — caching failure should not break the pipeline
  }
}
