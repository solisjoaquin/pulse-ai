import type { Overlap, TeamMember } from '@/types'

interface OverlapAlertProps {
  overlap: Overlap
  members: TeamMember[]
}

function getMemberNames(memberIds: [string, string], members: TeamMember[]): string {
  const names = memberIds.map((id) => {
    const found = members.find((m) => m.userId === id)
    return found?.name.split(' ')[0] ?? 'Unknown'
  })
  return `${names[0]} & ${names[1]}`
}

export default function OverlapAlert({ overlap, members }: OverlapAlertProps): React.ReactElement {
  const isConflict  = overlap.type === 'conflict'
  const isSynergy   = overlap.type === 'synergy'
  const isAwareness = overlap.type === 'awareness'

  const memberNames = getMemberNames(overlap.memberIds, members)
  const typeLabel   = isConflict ? 'Conflict' : isSynergy ? 'Synergy' : 'Awareness'

  const repoLabel = overlap.repos.length > 1
    ? `${overlap.repos.length} repos`
    : overlap.repos[0] ?? ''

  // Card styles
  const cardStyle: React.CSSProperties = isConflict
    ? { border: '1px solid #E24B4A', background: '#FCEBEB' }
    : isSynergy
    ? { border: '1px solid #5DCAA5', background: '#E1F5EE' }
    : { border: '0.5px solid var(--color-border-tertiary)', background: 'var(--color-background-primary)' }

  const iconBg     = isConflict ? '#F7C1C1' : isSynergy ? '#9FE1CB' : 'var(--color-background-secondary)'
  const iconStroke = isConflict ? '#A32D2D' : isSynergy ? '#085041' : 'var(--color-text-secondary)'
  const titleColor = isConflict ? '#A32D2D' : isSynergy ? '#085041' : 'var(--color-text-primary)'

  const tagStyle: React.CSSProperties = isConflict
    ? { background: '#F7C1C1', color: '#791F1F' }
    : isSynergy
    ? { background: '#9FE1CB', color: '#085041' }
    : { background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', border: '0.5px solid var(--color-border-tertiary)' }

  return (
    <article
      role="alert"
      aria-label={`${typeLabel} overlap between ${memberNames}`}
      style={{
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        ...cardStyle,
      }}
    >
      {/* Icon circle */}
      <div
        aria-hidden="true"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {isConflict && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        )}
        {isSynergy && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        )}
        {isAwareness && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: titleColor, marginBottom: '3px' }}>
          {typeLabel} — {memberNames}
          {overlap.paths.length > 0 && ` · ${overlap.paths[0]}`}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          {overlap.detail || overlap.reason}
        </p>

        {/* Tags */}
        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          <span
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 500,
              padding: '2px 8px',
              borderRadius: '100px',
              ...tagStyle,
            }}
          >
            {typeLabel}
          </span>
          {repoLabel && (
            <span
              style={{
                display: 'inline-block',
                fontSize: '11px',
                fontWeight: 500,
                padding: '2px 8px',
                borderRadius: '100px',
                background: 'var(--color-background-secondary)',
                color: 'var(--color-text-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
              }}
            >
              {repoLabel}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
