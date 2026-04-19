'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import type { DailyBriefing } from '@/types'
import BriefingPlayer from '@/components/dashboard/BriefingPlayer'
import SourceStatus from '@/components/dashboard/SourceStatus'
import AssistantButton from '@/components/dashboard/AssistantButton'
import ErrorBoundary from '@/components/ErrorBoundary'

type PageState = 'loading' | 'generating' | 'ready' | 'error'

// Generating step states
type StepStatus = 'done' | 'active' | 'pending'

interface GeneratingStep {
  id: string
  label: string
  sub: string
  status: StepStatus
}

const INITIAL_STEPS: GeneratingStep[] = [
  { id: 'github',   label: 'GitHub',                        sub: 'Fetching commits, PRs, and reviews',    status: 'pending' },
  { id: 'google',   label: 'Google Calendar',               sub: 'Loading today\'s schedule',             status: 'pending' },
  { id: 'gemini',   label: 'Synthesizing with Gemini',      sub: 'Writing your briefing script...',       status: 'pending' },
  { id: 'elevenlabs', label: 'Generating audio with ElevenLabs', sub: 'Almost there',                    status: 'pending' },
]

export default function DashboardPage(): JSX.Element {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [state, setState] = useState<PageState>('loading')
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<GeneratingStep[]>(INITIAL_STEPS)

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace('/login')
    }
  }, [sessionStatus, router])

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      void loadBriefing()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus])

  function advanceStep(id: string): void {
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id === id) return { ...s, status: 'active' }
        const idx = prev.findIndex((x) => x.id === id)
        const sIdx = prev.findIndex((x) => x.id === s.id)
        if (sIdx < idx) return { ...s, status: 'done' }
        return s
      })
    )
  }

  function completeStep(id: string): void {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: 'done' } : s))
    )
  }

  async function loadBriefing(): Promise<void> {
    try {
      const statusRes = await fetch('/api/briefing/status')
      if (!statusRes.ok) throw new Error('Failed to check briefing status')

      const statusData = (await statusRes.json()) as { status: string; briefing?: DailyBriefing }

      if (statusData.status === 'ready' && statusData.briefing) {
        setBriefing(statusData.briefing)
        setState('ready')
        return
      }

      // Animate steps while generating
      setState('generating')
      setSteps(INITIAL_STEPS)

      // Simulate step progression (real generation is one call)
      advanceStep('github')
      await new Promise((r) => setTimeout(r, 800))
      completeStep('github')
      advanceStep('google')
      await new Promise((r) => setTimeout(r, 600))
      completeStep('google')
      advanceStep('gemini')

      const generateRes = await fetch('/api/briefing/generate', { method: 'POST' })
      if (!generateRes.ok) throw new Error('Failed to generate briefing')

      completeStep('gemini')
      advanceStep('elevenlabs')
      await new Promise((r) => setTimeout(r, 300))
      completeStep('elevenlabs')

      const generated = (await generateRes.json()) as DailyBriefing
      setBriefing(generated)
      setState('ready')
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setState('error')
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  // ── Session loading spinner ───────────────────────────────────────────────
  if (sessionStatus === 'loading') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" role="status" aria-label="Loading" />
      </div>
    )
  }

  // ── Generating view ───────────────────────────────────────────────────────
  if (state === 'generating') {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <Logo />

        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              border: '1.5px solid var(--pulse-green)',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--pulse-green-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--pulse-green)" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            </div>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            Building your briefing
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Pulling together everything that happened since yesterday.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {steps.map((step, i) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '1rem 0' }}>
              {/* Dot + connector */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                <StepDot status={step.status} />
                {i < steps.length - 1 && (
                  <div
                    style={{
                      width: '1.5px',
                      height: '24px',
                      background: step.status === 'done' ? 'var(--pulse-green-mid)' : 'var(--color-border-tertiary)',
                      margin: '4px 0',
                    }}
                  />
                )}
              </div>
              {/* Text */}
              <div style={{ paddingTop: '4px', flex: 1 }}>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: step.status === 'pending' ? 400 : 500,
                    color: step.status === 'pending' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                    marginBottom: '2px',
                  }}
                >
                  {step.label}
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: step.status === 'active' ? 'var(--pulse-green-dark)' : 'var(--color-text-secondary)',
                  }}
                >
                  {step.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
          Ready in about 30 seconds
        </p>
      </div>
    )
  }

  // ── Error view ────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <Logo />
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <p style={{ fontSize: '14px', color: '#DC2626' }}>{error ?? 'Something went wrong'}</p>
          <button
            type="button"
            onClick={() => { setState('loading'); void loadBriefing() }}
            style={{
              padding: '8px 20px',
              background: 'var(--color-text-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--border-radius-md)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Loading spinner (initial) ─────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" role="status" aria-label="Loading" />
      </div>
    )
  }

  // ── Ready view ────────────────────────────────────────────────────────────
  const sources = briefing?.sources
  const content = briefing?.content

  // Compute stats from briefing data
  const totalMeetingMins = briefing?.sources.google?.totalMeetingMinutes ?? 0
  const meetingHours = totalMeetingMins > 0
    ? totalMeetingMins >= 60
      ? `${(totalMeetingMins / 60).toFixed(1).replace('.0', '')} hrs`
      : `${totalMeetingMins} min`
    : null
  const meetingCount = briefing?.sources.google?.events.length ?? 0
  const openPRs = briefing?.sources.github?.openPRs.length ?? 0
  const pendingReviews = briefing?.sources.github?.pendingReviews.length ?? 0
  const blockers = content?.blockers.length ?? 0
  const mergedPRs = briefing?.sources.github?.mergedPRs.length ?? 0

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
        }}
      >
        <Logo />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{today}</span>
          <div
            aria-label={session?.user?.name ?? 'User'}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--color-background-info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--color-text-info)',
              border: '0.5px solid var(--color-border-tertiary)',
              flexShrink: 0,
            }}
          >
            {userInitials}
          </div>
        </div>
      </header>

      {/* Source pills */}
      {sources && (
        <div style={{ marginBottom: '1.5rem' }}>
          <SourceStatus sources={sources} />
        </div>
      )}

      {/* Briefing player */}
      {content && briefing?.audioUrl && (
        <div style={{ marginBottom: '1rem' }}>
          <ErrorBoundary>
            <BriefingPlayer
              audioUrl={briefing.audioUrl}
              transcript={content.summary}
              briefing={content}
            />
          </ErrorBoundary>
        </div>
      )}

      {/* Bottom row: Ask Pulse + Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
        }}
      >
        {/* Ask Pulse card */}
        <div
          style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
              Ask Pulse
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              Ask anything about your PRs, tickets, or today&apos;s meetings.
            </p>
          </div>
          <ErrorBoundary>
            <AssistantButton />
          </ErrorBoundary>
        </div>

        {/* Stats card */}
        <div
          style={{
            background: 'var(--color-background-primary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            Today at a glance
          </p>

          <StatRow
            label="Meetings"
            value={meetingCount > 0 ? `${meetingCount}${meetingHours ? ` · ${meetingHours}` : ''}` : '—'}
            tone={meetingCount >= 4 ? 'warn' : 'neutral'}
          />
          <Divider />
          <StatRow label="Open PRs" value={openPRs > 0 ? String(openPRs) : '—'} tone="neutral" />
          <Divider />
          <StatRow label="Pending reviews" value={pendingReviews > 0 ? String(pendingReviews) : '—'} tone="neutral" />
          <Divider />
          <StatRow label="Blockers" value={blockers > 0 ? String(blockers) : '—'} tone={blockers > 0 ? 'warn' : 'neutral'} />
          <Divider />
          <StatRow
            label="Merged yesterday"
            value={mergedPRs > 0 ? `${mergedPRs} PR${mergedPRs > 1 ? 's' : ''}` : '—'}
            tone={mergedPRs > 0 ? 'good' : 'neutral'}
          />
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Logo(): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: 'var(--pulse-green)',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span style={{ fontSize: '18px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
        Pulse
      </span>
    </div>
  )
}

function StepDot({ status }: { status: StepStatus }): JSX.Element {
  const base: React.CSSProperties = {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  }

  if (status === 'done') {
    return (
      <div style={{ ...base, background: 'var(--pulse-green-light)', border: '1px solid var(--pulse-green-mid)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pulse-green-dark)" strokeWidth="2.5" aria-hidden="true">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    )
  }

  if (status === 'active') {
    return (
      <div style={{ ...base, background: 'var(--pulse-green)' }}>
        <div
          aria-label="Loading"
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            border: '1.5px solid rgba(255,255,255,0.3)',
            borderTopColor: 'white',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        ...base,
        background: 'var(--color-background-secondary)',
        border: '0.5px solid var(--color-border-tertiary)',
      }}
    />
  )
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'neutral' | 'warn' | 'good'
}): JSX.Element {
  const valueColor =
    tone === 'warn' ? '#BA7517' :
    tone === 'good' ? 'var(--pulse-green-dark)' :
    'var(--color-text-primary)'

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, color: valueColor }}>{value}</span>
    </div>
  )
}

function Divider(): JSX.Element {
  return <div style={{ height: '0.5px', background: 'var(--color-border-tertiary)' }} />
}
