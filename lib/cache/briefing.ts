import type { DailyBriefing } from '@/types'

const CACHE_TTL_SECONDS = 86_400 // 24 hours

function buildCacheKey(userId: string, date: string): string {
  return `briefing:${userId}:${date}`
}

// ─── In-process memory fallback (used when KV is not configured) ──────────────
// Scoped to the server process — survives across requests in the same process,
// which is sufficient for local dev and demo mode.
const memoryCache = new Map<string, DailyBriefing>()

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

export async function getCachedBriefing(
  userId: string,
  date: string
): Promise<DailyBriefing | null> {
  try {
    const kv = await getKv()
    if (!kv) {
      // Fall back to in-process memory cache
      return memoryCache.get(buildCacheKey(userId, date)) ?? null
    }

    const key = buildCacheKey(userId, date)
    const cached = await kv.get<DailyBriefing>(key)
    return cached ?? null
  } catch (error) {
    console.error('[Cache] getCachedBriefing failed:', error)
    return null
  }
}

export async function cacheBriefing(briefing: DailyBriefing): Promise<void> {
  try {
    const kv = await getKv()
    if (!kv) {
      // Fall back to in-process memory cache
      memoryCache.set(buildCacheKey(briefing.userId, briefing.date), briefing)
      return
    }

    const key = buildCacheKey(briefing.userId, briefing.date)
    await kv.set(key, briefing, { ex: CACHE_TTL_SECONDS })
  } catch (error) {
    console.error('[Cache] cacheBriefing failed:', error)
    // Don't throw — caching failure should not break the pipeline
  }
}
