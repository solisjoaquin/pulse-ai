import type { TeamMember, MemberActivity } from '@/types'

interface MemberCardProps {
  member: TeamMember
  activity: MemberActivity | null
}

interface ConnectionDotsProps {
  connections: TeamMember['connections']
}

function ConnectionDots({ connections }: ConnectionDotsProps): React.ReactElement {
  const sources: { key: keyof TeamMember['connections']; label: string }[] = [
    { key: 'github', label: 'GitHub' },
    { key: 'google', label: 'Google' },
    { key: 'jira', label: 'Jira' },
  ]

  return (
    <div className="flex items-center gap-1.5" aria-label="Connection status">
      {sources.map(({ key, label }) => (
        <span
          key={key}
          title={connections[key] ? `${label}: connected` : `${label}: not connected`}
          aria-label={connections[key] ? `${label} connected` : `${label} not connected`}
          className={[
            'inline-block h-2 w-2 rounded-full',
            connections[key] ? 'bg-[#1D9E75]' : 'bg-gray-300',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

interface AvatarProps {
  name: string
  avatarUrl: string
}

function Avatar({ name, avatarUrl }: AvatarProps): React.ReactElement {
  const initials = name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={`${name}'s avatar`}
        className="h-10 w-10 shrink-0 rounded-full object-cover"
        width={40}
        height={40}
      />
    )
  }

  return (
    <div
      aria-label={`${name}'s avatar`}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-600"
    >
      {initials}
    </div>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffHours < 1) return 'Updated just now'
  if (diffHours < 24) return `Updated ${diffHours}h ago`
  if (diffDays === 1) return 'Updated yesterday'
  return `Updated ${diffDays} days ago`
}

export default function MemberCard({ member, activity }: MemberCardProps): React.ReactElement {
  const focusSummary = activity?.focusSummary ?? null
  const lastUpdated = activity?.date ? formatRelativeDate(activity.date) : null

  return (
    <article className="flex w-full flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Header: avatar + name + connection dots */}
      <div className="flex items-center gap-3">
        <Avatar name={member.name} avatarUrl={member.avatarUrl} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-gray-900">{member.name}</span>
            <ConnectionDots connections={member.connections} />
          </div>

          {lastUpdated && (
            <p className="mt-0.5 text-xs text-gray-400">{lastUpdated}</p>
          )}
        </div>
      </div>

      {/* Focus summary */}
      <p className="text-sm leading-relaxed text-gray-600">
        {focusSummary ?? 'No recent activity'}
      </p>
    </article>
  )
}
