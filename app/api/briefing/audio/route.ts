import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateAudio } from '@/lib/voice/tts'
import { getCachedBriefing, cacheBriefing } from '@/lib/cache/briefing'

type AudioReadyResponse = { audioUrl: string }
type ErrorResponse = { error: string }

export async function POST(): Promise<NextResponse<AudioReadyResponse | ErrorResponse>> {
  const isDemoMode = process.env.DEMO_MODE === 'true'
  const session = await auth()

  if (!isDemoMode && !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId: string = isDemoMode ? 'demo-user' : (session!.user!.id as string)
  const today = new Date().toISOString().split('T')[0]

  // 1. Load the cached briefing — must exist before audio can be generated
  const briefing = await getCachedBriefing(userId, today)
  if (!briefing) {
    return NextResponse.json(
      { error: 'No briefing found for today. Generate the briefing first.' },
      { status: 404 }
    )
  }

  // 2. Return cached audio URL if already generated
  if (briefing.audioUrl) {
    return NextResponse.json({ audioUrl: briefing.audioUrl })
  }

  if (!briefing.content) {
    return NextResponse.json(
      { error: 'Briefing content is missing.' },
      { status: 422 }
    )
  }

  // 3. Build the spoken text from briefing content
  const spokenText = [
    briefing.content.summary,
    ...briefing.content.achievements,
    ...briefing.content.blockers.map((b) => b.description ?? b.title),
    ...briefing.content.pending.map((p) => p.title),
  ].join(' ')

  // 4. Generate audio via ElevenLabs
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

  // 5. Update the cached briefing with the audio URL
  await cacheBriefing({ ...briefing, audioUrl })

  return NextResponse.json({ audioUrl })
}
