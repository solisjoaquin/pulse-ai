import type { Overlap, TeamMember } from '@/types'

interface OverlapAlertProps {
  overlap: Overlap
  members: TeamMember[]
}

interface BadgeConfig {
  label: string
  badgeClass: string
  cardClass: string
  iconPath: string
  iconClass: string
}

const BADGE_CONFIG: Record<Overlap['type'], BadgeConfig> = {
  conflict: {
    label: 'CONFLICT',
    badgeClass: 'bg-red-100 text-red-700 ring-1 ring-red-300',
    cardClass: 'border-red-400 bg-red-50 shadow-md',
    iconPath:
      'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
    iconClass: 'text-red-600',
  },
  synergy: {
    label: 'SYNERGY',
    badgeClass: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
    cardClass: 'border-blue-300 bg-blue-50 shadow-sm',
    iconPath:
      'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z',
    iconClass: 'text-blue-500',
  },
  awareness: {
    label: 'AWARENESS',
    badgeClass: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300',
    cardClass: 'border-amber-300 bg-amber-50 shadow-sm',
    iconPath:
      'M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
    iconClass: 'text-amber-600',
  },
}

function getMemberNames(memberIds: [string, string], members: TeamMember[]): string {
  const names = memberIds.map((id) => {
    const found = members.find((m) => m.userId === id)
    return found?.name ?? 'Unknown'
  })
  return `${names[0]} & ${names[1]}`
}

export default function OverlapAlert({ overlap, members }: OverlapAlertProps): React.ReactElement {
  const config = BADGE_CONFIG[overlap.type]
  const memberNames = getMemberNames(overlap.memberIds, members)
  const isConflict = overlap.type === 'conflict'
  const isSynergy = overlap.type === 'synergy'

  return (
    <article
      className={[
        'flex w-full flex-col gap-3 rounded-xl border-2 p-4',
        config.cardClass,
        isConflict ? 'ring-2 ring-red-300 ring-offset-1' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="alert"
      aria-label={`${config.label} overlap between ${memberNames}`}
    >
      {/* Header: icon + badge + member names */}
      <div className="flex items-start gap-3">
        {/* Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={isConflict ? 2 : 1.5}
          stroke="currentColor"
          className={['mt-0.5 h-5 w-5 shrink-0', config.iconClass].join(' ')}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={config.iconPath} />
        </svg>

        <div className="min-w-0 flex-1">
          {/* Badge + member names row */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold tracking-wide',
                config.badgeClass,
              ].join(' ')}
            >
              {config.label}
            </span>
            <span
              className={[
                'truncate text-sm font-semibold',
                isConflict ? 'text-red-900' : 'text-gray-800',
              ].join(' ')}
            >
              {memberNames}
            </span>
          </div>
        </div>
      </div>

      {/* Reason text */}
      <p
        className={[
          'text-sm leading-relaxed',
          isConflict ? 'font-medium text-red-800' : 'text-gray-700',
        ].join(' ')}
      >
        {overlap.reason}
      </p>

      {/* Type-specific footer */}
      {isConflict && (
        <div className="flex items-center gap-1.5 rounded-lg bg-red-100 px-3 py-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-red-600"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-xs font-semibold text-red-700">
            Coordinate before merging to avoid conflicts
          </span>
        </div>
      )}

      {isSynergy && (
        <div className="flex items-center gap-1.5 rounded-lg bg-blue-100 px-3 py-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-blue-600"
            aria-hidden="true"
          >
            <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM1.49 15.326a.78.78 0 0 1-.358-.442 3 3 0 0 1 4.308-3.516 6.484 6.484 0 0 0-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 0 1-2.07-.655ZM16.44 15.98a4.97 4.97 0 0 0 2.07-.654.78.78 0 0 0 .357-.442 3 3 0 0 0-4.308-3.517 6.484 6.484 0 0 1 1.907 3.96 2.32 2.32 0 0 1-.026.654ZM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM5.304 16.19a.844.844 0 0 1-.277-.71 5 5 0 0 1 9.947 0 .843.843 0 0 1-.277.71A6.975 6.975 0 0 1 10 18a6.974 6.974 0 0 1-4.696-1.81Z" />
          </svg>
          <span className="text-xs font-semibold text-blue-700">
            Consider syncing — you may be working toward the same goal
          </span>
        </div>
      )}
    </article>
  )
}
