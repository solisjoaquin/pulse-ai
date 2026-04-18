import { GoogleGenerativeAI } from '@google/generative-ai'
import type { BriefingContent, GitHubActivity, GoogleActivity, JiraActivity } from '@/types'
import { buildBriefingPrompt } from './prompts'

const GEMINI_MODEL = 'gemini-2.5-flash'

export async function synthesizeBriefing(data: {
  github: GitHubActivity | null
  google: GoogleActivity | null
  jira: JiraActivity | null
}): Promise<BriefingContent> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error('[Gemini] GOOGLE_API_KEY environment variable is not set')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

  const prompt = buildBriefingPrompt(data)

  const result = await model.generateContent(prompt)
  const text = result.response.text()

  // Parse JSON safely — strip any accidental markdown code fences
  let parsed: unknown
  try {
    const cleaned = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`[Gemini] Failed to parse JSON response: ${text.slice(0, 200)}`)
  }

  // Validate required fields before returning
  if (!isValidBriefingContent(parsed)) {
    throw new Error('[Gemini] Response does not match BriefingContent schema')
  }

  return parsed
}

function isValidBriefingContent(value: unknown): value is BriefingContent {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.summary === 'string' &&
    Array.isArray(obj.achievements) &&
    Array.isArray(obj.pending) &&
    Array.isArray(obj.blockers) &&
    Array.isArray(obj.todaySchedule) &&
    typeof obj.wordCount === 'number'
  )
}
