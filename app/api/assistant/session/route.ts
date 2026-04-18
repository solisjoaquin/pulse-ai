import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getCachedBriefing } from '@/lib/cache/briefing'

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1'

export async function POST(): Promise<NextResponse> {
  // Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID

  if (!apiKey) {
    return NextResponse.json(
      { error: 'ElevenLabs API key not configured' },
      { status: 500 }
    )
  }
  if (!agentId) {
    return NextResponse.json(
      { error: 'ElevenLabs Agent ID not configured' },
      { status: 500 }
    )
  }

  const userId = session.user.id
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Get today's briefing from cache
  const briefing = await getCachedBriefing(userId, today)

  // Build system prompt with full briefing context
  const briefingContext = briefing?.content
    ? JSON.stringify(briefing.content, null, 2)
    : 'No briefing available for today yet.'

  const systemPrompt = `You are Pulse, a work assistant. You have full knowledge of the user's work activity today. Here is their briefing:\n\n${briefingContext}\n\nAnswer questions about their pull requests, tickets, and meetings. Be concise. Speak in second person.`

  const firstMessage = briefing?.content?.summary
    ? `Good morning! ${briefing.content.summary} What would you like to know more about?`
    : 'Good morning! Your briefing is being prepared. How can I help you?'

  // Create ElevenLabs Conversational AI signed URL with agent override
  const response = await fetch(
    `${ELEVENLABS_API}/convai/conversation/get_signed_url`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_id: agentId,
        conversation_config_override: {
          agent: {
            prompt: {
              prompt: systemPrompt,
            },
            first_message: firstMessage,
          },
        },
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Assistant] ElevenLabs session creation failed:', errorText)
    return NextResponse.json(
      { error: 'Failed to initialize voice assistant' },
      { status: 500 }
    )
  }

  const data = (await response.json()) as { signed_url: string }
  return NextResponse.json({ signedUrl: data.signed_url })
}
