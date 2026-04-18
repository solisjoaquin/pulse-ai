import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { fetchGitHubActivity } from '@/lib/sources/github'
import { fetchGoogleActivity } from '@/lib/sources/google'
import { fetchJiraActivity } from '@/lib/sources/jira'
import { synthesizeBriefing } from '@/lib/ai/synthesize'
import { generateAudio } from '@/lib/voice/tts'
import { getCachedBriefing, cacheBriefing } from '@/lib/cache/briefing'
import type { DailyBriefing } from '@/types'

export async function POST(): Promise<NextResponse> {
  // 1. Auth check
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const session = await auth()

  if (!isDemoMode && !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId: string = isDemoMode ? 'demo-user' : (session!.user!.id as string)
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // 2. Check cache
  const cached = await getCachedBriefing(userId, today)
  if (cached) {
    return NextResponse.json(cached)
  }

  // 3. Fetch all sources in parallel
  const [githubResult, googleResult, jiraResult] = await Promise.allSettled([
    isDemoMode || session?.githubAccessToken
      ? fetchGitHubActivity(session?.githubAccessToken ?? '')
      : Promise.resolve(null),
    isDemoMode || session?.googleAccessToken
      ? fetchGoogleActivity(session?.googleAccessToken ?? '')
      : Promise.resolve(null),
    isDemoMode || (session?.jiraToken && session?.jiraDomain)
      ? fetchJiraActivity(session?.jiraToken ?? '', session?.jiraDomain ?? '')
      : Promise.resolve(null),
  ])

  const sources = {
    github: githubResult.status === 'fulfilled' ? githubResult.value : null,
    google: googleResult.status === 'fulfilled' ? googleResult.value : null,
    jira: jiraResult.status === 'fulfilled' ? jiraResult.value : null,
  }

  // 4. Synthesize briefing text via Gemini
  let content
  try {
    content = await synthesizeBriefing(sources)
  } catch (error) {
    console.error('[API] synthesizeBriefing failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate briefing text' },
      { status: 500 }
    )
  }

  // 5. Generate audio via ElevenLabs
  // Build the spoken text from the briefing content
  const spokenText = [
    content.summary,
    ...content.achievements,
    ...content.blockers.map((b) => b.description ?? b.title),
    ...content.pending.map((p) => p.title),
  ].join(' ')

  let audioUrl: string
  try {
    audioUrl = await generateAudio(spokenText, userId, today)
  } catch (error) {
    console.error('[API] generateAudio failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate audio' },
      { status: 500 }
    )
  }

  // 6. Build DailyBriefing object
  const briefing: DailyBriefing = {
    id: `${userId}-${today}`,
    userId,
    date: today,
    status: 'ready',
    sources,
    content,
    audioUrl,
    generatedAt: new Date().toISOString(),
  }

  // 7. Cache the briefing
  await cacheBriefing(briefing)

  // 8. Return briefing
  return NextResponse.json(briefing)
}
