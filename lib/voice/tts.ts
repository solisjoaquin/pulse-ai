import { put } from '@vercel/blob'

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1'
const ELEVENLABS_MODEL = 'eleven_turbo_v2'

export async function generateAudio(
  text: string,
  userId: string,
  date: string
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const voiceId = process.env.ELEVENLABS_VOICE_ID

  if (!apiKey) throw new Error('[ElevenLabs] ELEVENLABS_API_KEY is not set')
  if (!voiceId) throw new Error('[ElevenLabs] ELEVENLABS_VOICE_ID is not set')

  const response = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: ELEVENLABS_MODEL,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `[ElevenLabs] TTS API error ${response.status}: ${errorText.slice(0, 200)}`
    )
  }

  const audioBuffer = await response.arrayBuffer()

  // When Vercel Blob is not configured (local dev), return a base64 data URL
  // so the audio player can still function without cloud storage.
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('[TTS] BLOB_READ_WRITE_TOKEN not set — returning base64 data URL')
    const base64 = Buffer.from(audioBuffer).toString('base64')
    return `data:audio/mpeg;base64,${base64}`
  }

  const pathname = `briefings/${userId}/${date}.mp3`
  const blob = await put(pathname, audioBuffer, {
    access: 'public',
    contentType: 'audio/mpeg',
  })

  return blob.url
}
