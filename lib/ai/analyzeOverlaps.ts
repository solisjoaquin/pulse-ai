import { GoogleGenerativeAI } from '@google/generative-ai'
import type { MemberActivity, Overlap } from '@/types'
import { buildOverlapAnalysisPrompt } from './prompts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverlapSummary {
  userId: string
  focusSummary: string
  prTitles: string[]
  ticketTitles: string[]
}

/** Shape of each item inside the JSON array Gemini returns. */
interface GeminiOverlapItem {
  memberIds: [string, string]
  reason: string
  type: 'synergy' | 'awareness'
}

/** Top-level shape of the Gemini JSON response. */
interface GeminiOverlapResponse {
  overlaps: GeminiOverlapItem[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
const GEMINI_MODEL = 'gemini-2.5-flash'

// ─── Validation ───────────────────────────────────────────────────────────────

function isGeminiOverlapResponse(value: unknown): value is GeminiOverlapResponse {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.overlaps)) return false
  return obj.overlaps.every((item: unknown) => {
    if (typeof item !== 'object' || item === null) return false
    const o = item as Record<string, unknown>
    return (
      Array.isArray(o.memberIds) &&
      o.memberIds.length === 2 &&
      typeof o.memberIds[0] === 'string' &&
      typeof o.memberIds[1] === 'string' &&
      typeof o.reason === 'string' &&
      (o.type === 'synergy' || o.type === 'awareness')
    )
  })
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Pass 2 — Semantic overlap detection via Gemini.
 *
 * Sends each member's focusSummary, PR titles, and Jira ticket titles to
 * Gemini and asks it to identify pairs working on semantically similar
 * features. Only returns overlaps with type 'synergy'.
 *
 * Never throws — returns [] on any failure.
 */
export async function analyzeSemanticOverlaps(
  activities: MemberActivity[]
): Promise<Overlap[]> {
  // Need at least two members to form a pair
  if (activities.length < 2) {
    return []
  }

  if (!GOOGLE_API_KEY) {
    console.error('[analyzeSemanticOverlaps] GOOGLE_API_KEY is not set — skipping semantic analysis')
    return []
  }

  try {
    // Build per-member summaries from the activity data
    const summaries: OverlapSummary[] = activities.map((activity) => {
      const prTitles = [
        ...(activity.github?.openPRs.map((pr) => pr.title) ?? []),
        ...(activity.github?.mergedPRs.map((pr) => pr.title) ?? []),
      ]

      const ticketTitles = [
        ...(activity.jira?.inProgress.map((t) => t.title) ?? []),
        ...(activity.jira?.movedYesterday.map((t) => t.title) ?? []),
        ...(activity.jira?.blockers.map((t) => t.title) ?? []),
      ]

      return {
        userId: activity.userId,
        focusSummary: activity.focusSummary,
        prTitles,
        ticketTitles,
      }
    })

    const prompt = buildOverlapAnalysisPrompt(summaries)

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // Strip accidental markdown code fences before parsing
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseError) {
      console.error('[analyzeSemanticOverlaps] Failed to parse Gemini JSON response:', parseError)
      console.error('[analyzeSemanticOverlaps] Raw response:', text.slice(0, 500))
      return []
    }

    if (!isGeminiOverlapResponse(parsed)) {
      console.error(
        '[analyzeSemanticOverlaps] Gemini response does not match expected schema:',
        cleaned.slice(0, 500)
      )
      return []
    }

    const now = new Date().toISOString()

    // Map Gemini items to Overlap objects — only keep 'synergy' type as per spec
    const overlaps: Overlap[] = parsed.overlaps
      .filter((item) => item.type === 'synergy')
      .map(
        (item): Overlap => ({
          id: crypto.randomUUID(),
          type: 'synergy',
          memberIds: [item.memberIds[0], item.memberIds[1]],
          reason: item.reason,
          detail: item.reason,
          repos: [],
          paths: [],
          detectedAt: now,
        })
      )

    return overlaps
  } catch (error) {
    console.error('[analyzeSemanticOverlaps] Unexpected error during semantic analysis:', error)
    return []
  }
}
