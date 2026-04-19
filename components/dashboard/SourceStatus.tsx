'use client'

import type { DailyBriefing } from '@/types'

interface SourceStatusProps {
  sources: DailyBriefing['sources']
}

interface SourcePillProps {
  name: string
  connected: boolean
}

function SourcePill({ name, connected }: SourcePillProps): JSX.Element {
  return (
    <div
      title={connected ? `${name}: connected` : `${name}: not connected`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: '100px',
        border: '0.5px solid var(--color-border-tertiary)',
        background: 'var(--color-background-primary)',
        fontSize: '12px',
        color: 'var(--color-text-secondary)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: connected ? 'var(--pulse-green)' : '#EF9F27',
          flexShrink: 0,
        }}
      />
      <span>{connected ? name : `${name} — not connected`}</span>
    </div>
  )
}

export default function SourceStatus({ sources }: SourceStatusProps): JSX.Element {
  return (
    <div
      style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
      aria-label="Data source status"
    >
      <SourcePill name="GitHub" connected={sources.github !== null} />
      <SourcePill name="Google Calendar" connected={sources.google !== null} />
      <SourcePill name="Jira" connected={sources.jira !== null} />
    </div>
  )
}
