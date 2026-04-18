import { kv } from '@vercel/kv'
import type { DailyBriefing } from '@/types'

const CACHE_TTL_SECONDS = 86_400 // 24 hours

function buildCacheKey(userId: string, date: string): string {
  return `briefing:${userId}:${date}`
}

export async function getCachedBriefing(
  userId: string,
  date: string
): Promise<DailyBriefing | null> {
  try {
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
    const key = buildCacheKey(briefing.userId, briefing.date)
    await kv.set(key, briefing, { ex: CACHE_TTL_SECONDS })
  } catch (error) {
    console.error('[Cache] cacheBriefing failed:', error)
    // Don't throw — caching failure should not break the pipeline
  }
}
