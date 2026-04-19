'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { DailyBriefing, BriefingContent, Overlap } from '@/types'
import BriefingPlayer from '@/components/dashboard/BriefingPlayer'
import AssistantButton from '@/components/dashboard/AssistantButton'
import ErrorBoundary from '@/components/ErrorBoundary'

type PageState = 'loading' | 'generating' | 'ready' | 'error'
type AudioState = 'idle' | 'generating' | 'ready' | 'error'

type StepStatus = 'done' | 'active' | 'pending'

interface GeneratingStep {
  id: string
  label: string
  sub: string
  status: StepStatus
}

const INITIAL_STEPS: GeneratingStep[] = [
  { id: 'github', label: 'GitHub',                   sub: 'Fetching commits, PRs, and reviews', status: 'pending' },
  { id: 'google', label: 'Google Calendar',          sub: "Loading today's schedule",           status: 'pending' },
  { id: 'gemini', label: 'Synthesizing with Gemini', sub: 'Writing your briefing script...',    status: 'pending' },
]

export default function DashboardPage(): JSX.Element {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  const [state, setState] = useState<PageState>('loading')
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null)
  const [audioState, setAudioState] = useState<AudioState>('idle')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioError, setAudioError] = useState<string | null>(null)
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
        const cached = statusData.briefing
        setBriefing(cached)
        // If audio was already generated previously, restore it
        if (cached.audioUrl) {
          setAudioUrl(cached.audioUrl)
          setAudioState('ready')
        }
        setState('ready')
        return
      }

      // No cached briefing — generate text now (audio is on-demand)
      setState('generating')
      setSteps(INITIAL_STEPS)

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

      const generated = (await generateRes.json()) as DailyBriefing
      setBriefing(generated)
      setState('ready')
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setState('error')
    }
  }

  async function handleGenerateAudio(): Promise<void> {
    setAudioState('generating')
    setAudioError(null)
    try {
      const res = await fetch('/api/briefing/audio', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to generate audio')
      const data = (await res.json()) as { audioUrl: string }
      setAudioUrl(data.audioUrl)
      setAudioState('ready')
    } catch (err) {
      console.error('Audio generation error:', err)
      setAudioError(err instanceof Error ? err.message : 'Failed to generate audio')
      setAudioState('error')
    }
  }

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
        <div style={{ textAlign: 'center', marginBottom: '2.5rem', marginTop: '2rem' }}>
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
          Ready in about 15 seconds
        </p>
      </div>
    )
  }

  // ── Error view ────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <Logo />
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '2rem' }}>
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
  const content = briefing?.content
  const overlaps = briefing?.relevantOverlaps ?? []

  const totalMeetingMins = briefing?.sources.google?.totalMeetingMinutes ?? 0
  const meetingHours = totalMeetingMins > 0
    ? totalMeetingMins >= 60
      ? `${(totalMeetingMins / 60).toFixed(1).replace('.0', '')} hrs`
      : `${totalMeetingMins} min`
    : null
  const meetingCount = briefing?.sources.google?.events.length ?? 0
  const openPRs = briefing?.sources.github?.openPRs.length ?? 0
  const conflicts = overlaps.filter((o) => o.type === 'conflict').length
  const synergies = overlaps.filter((o) => o.type === 'synergy').length
  const mergedPRs = briefing?.sources.github?.mergedPRs.length ?? 0

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        <Logo />

        <nav style={{ display: 'flex', gap: '4px' }} aria-label="Dashboard navigation">
          <Link
            href="/dashboard"
            style={{
              padding: '5px 14px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              background: pathname === '/dashboard' ? 'var(--pulse-green)' : 'none',
              color: pathname === '/dashboard' ? '#fff' : 'var(--color-text-secondary)',
              border: pathname === '/dashboard' ? 'none' : '0.5px solid var(--color-border-tertiary)',
            }}
          >
            My briefing
          </Link>
          <Link
            href="/dashboard/team"
            style={{
              padding: '5px 14px',
              borderRadius: '100px',
              fontSize: '13px',
              fontWeight: 500,
              textDecoration: 'none',
              background: pathname === '/dashboard/team' ? 'var(--pulse-green)' : 'none',
              color: pathname === '/dashboard/team' ? '#fff' : 'var(--color-text-secondary)',
              border: pathname === '/dashboard/team' ? 'none' : '0.5px solid var(--color-border-tertiary)',
            }}
          >
            Team
          </Link>
        </nav>

        <div
          aria-label={session?.user?.name ?? 'User'}
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            background: 'var(--color-background-info)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 500,
            color: 'var(--color-text-info)',
            flexShrink: 0,
          }}
        >
          {userInitials}
        </div>
      </header>

      {/* ── Main grid: player (wider) + right column ────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        {/* Briefing player / audio card */}
        {audioState === 'ready' && content && audioUrl ? (
          <ErrorBoundary>
            <BriefingPlayer
              audioUrl={audioUrl}
              transcript={content.summary}
              briefing={content}
            />
          </ErrorBoundary>
        ) : (
          <BriefingAudioCard
            content={content ?? null}
            audioState={audioState}
            audioError={audioError}
            onGenerate={() => void handleGenerateAudio()}
          />
        )}

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Ask Pulse card */}
          <div
            style={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <p
              style={{
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-tertiary)',
                marginBottom: '4px',
              }}
            >
              Ask Pulse
            </p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '0' }}>
              Ask about your work or what your teammates are up to.
            </p>
            <ErrorBoundary>
              <AssistantButton />
            </ErrorBoundary>
          </div>

          {/* Today at a glance card */}
          <div
            style={{
              background: 'var(--color-background-primary)',
              border: '0.5px solid var(--color-border-tertiary)',
              borderRadius: '12px',
              padding: '1.25rem',
            }}
          >
            <p
              style={{
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-tertiary)',
                marginBottom: '0.75rem',
              }}
            >
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
            <StatRow
              label="Team conflicts"
              value={conflicts > 0 ? String(conflicts) : '—'}
              tone={conflicts > 0 ? 'danger' : 'neutral'}
            />
            <Divider />
            <StatRow
              label="Synergies"
              value={synergies > 0 ? String(synergies) : '—'}
              tone={synergies > 0 ? 'good' : 'neutral'}
            />
            <Divider />
            <StatRow
              label="Merged yesterday"
              value={mergedPRs > 0 ? `${mergedPRs} PR${mergedPRs > 1 ? 's' : ''}` : '—'}
              tone={mergedPRs > 0 ? 'good' : 'neutral'}
            />
          </div>
        </div>
      </div>

      {/* ── Team overlaps section ───────────────────────────────────────── */}
      {overlaps.length > 0 && (
        <section aria-labelledby="overlaps-heading">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}
          >
            <p
              style={{
                fontSize: '11px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--color-text-tertiary)',
                margin: 0,
              }}
              id="overlaps-heading"
            >
              Team overlaps
            </p>
            <span
              style={{
                fontSize: '12px',
                color: 'var(--color-text-tertiary)',
                background: 'var(--color-background-secondary)',
                padding: '2px 8px',
                borderRadius: '100px',
                border: '0.5px solid var(--color-border-tertiary)',
              }}
            >
              {overlaps.length} detected today
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {overlaps.map((overlap) => (
              <InlineOverlapAlert key={overlap.id} overlap={overlap} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Logo(): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '9px',
          height: '9px',
          borderRadius: '50%',
          background: 'var(--pulse-green)',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span style={{ fontSize: '17px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
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

// Card shown in the player slot before audio is generated
function BriefingAudioCard({
  content,
  audioState,
  audioError,
  onGenerate,
}: {
  content: BriefingContent | null
  audioState: AudioState
  audioError: string | null
  onGenerate: () => void
}): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Label */}
      <p
        style={{
          fontSize: '11px',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-text-tertiary)',
          marginBottom: '0.75rem',
        }}
      >
        Today&apos;s briefing
      </p>

      {/* Summary text — shown when content is available */}
      {content?.summary ? (
        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-text-primary)',
            lineHeight: 1.6,
            marginBottom: '1.25rem',
            flex: 1,
          }}
        >
          {content.summary}
        </p>
      ) : (
        <p
          style={{
            fontSize: '14px',
            color: 'var(--color-text-tertiary)',
            lineHeight: 1.6,
            marginBottom: '1.25rem',
            flex: 1,
          }}
        >
          Your briefing is ready to listen.
        </p>
      )}

      {/* Error message */}
      {audioState === 'error' && audioError && (
        <p
          role="alert"
          style={{ fontSize: '12px', color: '#DC2626', marginBottom: '0.75rem' }}
        >
          {audioError}
        </p>
      )}

      {/* Generate audio button / loading state */}
      {audioState === 'generating' ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '9px 14px',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <div
            role="status"
            aria-label="Generating audio..."
            style={{
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '1.5px solid var(--color-border-primary)',
              borderTopColor: 'var(--pulse-green)',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }}
          />
          Generating audio with ElevenLabs...
        </div>
      ) : (
        <button
          type="button"
          onClick={onGenerate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 14px',
            background: 'none',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            width: '100%',
            justifyContent: 'center',
            fontFamily: 'inherit',
            minHeight: '44px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pulse-green)" strokeWidth="2" aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          {audioState === 'error' ? 'Retry audio generation' : 'Generate audio briefing'}
        </button>
      )}
    </div>
  )
}

function StatRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'neutral' | 'warn' | 'good' | 'danger'
}): JSX.Element {
  const valueColor =
    tone === 'warn'   ? '#BA7517' :
    tone === 'good'   ? '#0F6E56' :
    tone === 'danger' ? '#A32D2D' :
    'var(--color-text-primary)'

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '5px 0' }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: 500, color: valueColor }}>{value}</span>
    </div>
  )
}

function Divider(): JSX.Element {
  return <div style={{ height: '0.5px', background: 'var(--color-border-tertiary)' }} />
}

function InlineOverlapAlert({ overlap }: { overlap: Overlap }): JSX.Element {
  const isConflict  = overlap.type === 'conflict'
  const isSynergy   = overlap.type === 'synergy'
  const isAwareness = overlap.type === 'awareness'

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

  const typeLabel = isConflict ? 'Conflict' : isSynergy ? 'Synergy' : 'Awareness'

  const repoLabel = overlap.repos.length > 1
    ? `${overlap.repos.length} repos`
    : overlap.repos[0] ?? ''

  return (
    <div
      role="alert"
      style={{
        borderRadius: '12px',
        padding: '1rem 1.25rem',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
        ...cardStyle,
      }}
    >
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

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: titleColor, marginBottom: '3px' }}>
          {typeLabel} · {overlap.reason.split('—')[0]?.trim() ?? overlap.reason}
        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          {overlap.detail || overlap.reason}
        </p>
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
    </div>
  )
}
