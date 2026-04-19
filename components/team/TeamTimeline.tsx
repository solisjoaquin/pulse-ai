import type { MemberActivity, CalendarEvent } from '@/types'

interface TeamTimelineProps {
  activities: MemberActivity[]
}

/**
 * Aggregate all calendar events from all members, deduplicate by title + start time,
 * keeping the event with the highest attendee count when duplicates are found.
 */
function aggregateEvents(activities: MemberActivity[]): CalendarEvent[] {
  // Map key: `${title}::${start}` → best event seen so far
  const deduped = new Map<string, CalendarEvent>()

  for (const activity of activities) {
    if (activity.google === null) continue

    for (const event of activity.google.events) {
      const key = `${event.title}::${event.start}`
      const existing = deduped.get(key)

      if (existing === undefined || event.attendees > existing.attendees) {
        deduped.set(key, event)
      }
    }
  }

  // Sort chronologically by start time
  return Array.from(deduped.values()).sort((a, b) => {
    return new Date(a.start).getTime() - new Date(b.start).getTime()
  })
}

function formatTime(isoString: string): string {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

interface TimelineEventProps {
  event: CalendarEvent
  isLast: boolean
}

function TimelineEvent({ event, isLast }: TimelineEventProps): React.ReactElement {
  const formattedTime = formatTime(event.start)
  const attendeeLabel = event.attendees === 1 ? '1 attendee' : `${event.attendees} attendees`

  return (
    <li className="relative flex gap-4">
      {/* Vertical connector line */}
      {!isLast && (
        <span
          className="absolute left-[2.375rem] top-8 h-full w-px bg-gray-200"
          aria-hidden="true"
        />
      )}

      {/* Time column */}
      <div className="w-16 shrink-0 pt-1 text-right">
        <time
          dateTime={event.start}
          className="text-xs font-medium tabular-nums text-gray-500"
        >
          {formattedTime}
        </time>
      </div>

      {/* Dot */}
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
        <span className="h-2.5 w-2.5 rounded-full bg-[#1D9E75] ring-2 ring-white" aria-hidden="true" />
      </div>

      {/* Event details */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-gray-900">{event.title}</span>

          {/* Video call indicator */}
          {event.isVideo && (
            <span
              title="Video call"
              aria-label="Video call"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600 ring-1 ring-indigo-200"
            >
              {/* Camera icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-3 w-3"
                aria-hidden="true"
              >
                <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM19 4.75a.75.75 0 0 0-1.28-.53l-3 3a.75.75 0 0 0-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 0 0 1.28-.53V4.75Z" />
              </svg>
              Video
            </span>
          )}
        </div>

        <p className="mt-0.5 text-xs text-gray-400">{attendeeLabel}</p>
      </div>
    </li>
  )
}

export default function TeamTimeline({ activities }: TeamTimelineProps): React.ReactElement {
  const events = aggregateEvents(activities)

  return (
    <section aria-label="Shared team meetings today">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Shared Meetings Today
      </h2>

      {events.length === 0 ? (
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-12">
          <p className="text-sm text-gray-500">No shared meetings today</p>
        </div>
      ) : (
        <ol className="list-none" aria-label="Timeline of shared meetings">
          {events.map((event, index) => (
            <TimelineEvent
              key={`${event.title}::${event.start}`}
              event={event}
              isLast={index === events.length - 1}
            />
          ))}
        </ol>
      )}
    </section>
  )
}
