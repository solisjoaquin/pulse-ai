import type { GoogleActivity, CalendarEvent } from '@/types'
import { MOCK_GOOGLE } from '@/lib/mock/data'

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const TIMEOUT_MS = 10_000

// ─── Fetch helper with timeout ────────────────────────────────────────────────

async function googleFetch(url: string, token: string): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// ─── Response shape types (Google Calendar REST API) ─────────────────────────

interface GoogleCalendarEventAttendee {
  email: string
}

interface GoogleCalendarEventDateTime {
  dateTime?: string
  date?: string
  timeZone?: string
}

interface GoogleCalendarEventItem {
  id: string
  summary?: string
  start: GoogleCalendarEventDateTime
  end: GoogleCalendarEventDateTime
  attendees?: GoogleCalendarEventAttendee[]
  hangoutLink?: string
}

interface GoogleCalendarEventsResponse {
  items: GoogleCalendarEventItem[]
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchGoogleActivity(
  token: string
): Promise<GoogleActivity | null> {
  if (process.env.DEMO_MODE === 'true') {
    return MOCK_GOOGLE
  }

  try {
    // Build timeMin (midnight UTC) and timeMax (23:59:59 UTC) for today
    const now = new Date()
    const timeMin = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0)
    ).toISOString()
    const timeMax = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59)
    ).toISOString()

    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '20',
    })

    const url = `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`
    const response = await googleFetch(url, token)

    if (!response.ok) {
      console.error(
        '[Google] Failed to fetch calendar events:',
        response.status,
        response.statusText
      )
      return null
    }

    const data = (await response.json()) as GoogleCalendarEventsResponse

    // Map API items to CalendarEvent, skipping all-day events (no dateTime)
    const events: CalendarEvent[] = data.items
      .filter(
        (item) =>
          item.start.dateTime !== undefined && item.end.dateTime !== undefined
      )
      .map((item) => {
        const start = item.start.dateTime as string
        const end = item.end.dateTime as string

        return {
          id: item.id,
          title: item.summary ?? '(No title)',
          start,
          end,
          attendees: item.attendees?.length ?? 0,
          isVideo: item.hangoutLink !== undefined,
          hangoutLink: item.hangoutLink,
        }
      })

    // Compute total meeting minutes across all events
    const totalMeetingMinutes = events.reduce((total, event) => {
      const durationMs =
        new Date(event.end).getTime() - new Date(event.start).getTime()
      const durationMin = Math.round(durationMs / 60_000)
      return total + durationMin
    }, 0)

    return {
      events,
      totalMeetingMinutes,
    }
  } catch (error) {
    console.error('[Google] fetchGoogleActivity failed:', error)
    return null
  }
}
