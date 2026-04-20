'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type {
  DailyBriefing,
  GitHubActivity,
  GoogleActivity,
  JiraActivity,
  Overlap,
  BriefingContent,
} from '@/types'
import type { DashboardData } from '@/app/api/dashboard/data/route'
import BriefingPlayer from '@/components/dashboard/BriefingPlayer'
import AssistantButton from '@/components/dashboard/AssistantButton'
import ErrorBoundary from '@/components/ErrorBoundary'

// ─── State types ──────────────────────────────────────────────────────────────

type PageState = 'loading' | 'ready' | 'error'

// Tracks the full audio briefing pipeline (Gemini text + ElevenLabs audio)
type BriefingState = 'idle' | 'generating' | 'ready' | 'error'

type StepStatus = 'done' | 'active' | 'pending'

interface GeneratingStep {
  id: string
  label: string
  sub: string
  status: StepStatus
}

const INITIAL_STEPS: GeneratingStep[] = [
  { id: 'github', label: 'GitHub',         sub: 'Fetching commits, PRs, and reviews', status: 'pending' },
  { id: 'google', label: 'Google Calendar', sub: "Loading today's schedule",           status: 'pending' },
  { id: 'gemini', label: 'Gemini',          sub: 'Writing your briefing script',       status: 'pending' },
  { id: 'audio',  label: 'ElevenLabs',      sub: 'Generating audio',                   status: 'pending' },
]

// ─── Page component ───────────────────────────────────────────────────────────

export default function DashboardPage(): JSX.Element {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  // Page-level state
  const [pageState, setPageState] = useState<PageState>('loading')
  const [pageError, setPageError] = useState<string | null>(null)

  // Dashboard data — loaded immediately on mount, independent of briefing
  const [github, setGithub] = useState<GitHubActivity | null>(null)
  const [google, setGoogle] = useState<GoogleActivity | null>(null)
  const [jira, setJira] = useState<JiraActivity | null>(null)
  const [overlaps, setOverlaps] = useState<Overlap[]>([])

  // Briefing / audio state
  const [briefingState, setBriefingState] = useState<BriefingState>('idle')
  const [briefingError, setBriefingError] = useState<string | null>(null)
  const [briefingContent, setBriefingContent] = useState<BriefingContent | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [steps, setSteps] = useState<GeneratingStep[]>(INITIAL_STEPS)

  // ── Auth redirect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace('/login')
    }
  }, [sessionStatus, router])

  // ── Initial data load ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      void loadDashboard()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus])

  async function loadDashboard(): Promise<void> {
    try {
      // Load sources/overlaps and cached briefing in parallel
      const [dataRes, statusRes] = await Promise.all([
        fetch('/api/dashboard/data'),
        fetch('/api/briefing/status'),
      ])

      if (!dataRes.ok) throw new Error('Failed to load dashboard data')
      if (!statusRes.ok) throw new Error('Failed to check briefing status')

      const data = (await dataRes.json()) as DashboardData
      const statusData = (await statusRes.json()) as { status: string; briefing?: DailyBriefing }

      // Populate dashboard components immediately
      setGithub(data.github)
      setGoogle(data.google)
      setJira(data.jira)
      setOverlaps(data.overlaps)

      // Restore cached briefing + audio if available
      if (statusData.status === 'ready' && statusData.briefing) {
        const cached = statusData.briefing
        setBriefingContent(cached.content)
        if (cached.audioUrl) {
          setAudioUrl(cached.audioUrl)
          setBriefingState('ready')
        }
        // If briefing text exists but no audio, stay idle so user can generate audio
      }

      setPageState('ready')
    } catch (err) {
      console.error('Dashboard load error:', err)
      setPageError(err instanceof Error ? err.message : 'Something went wrong')
      setPageState('error')
    }
  }

  // ── Step helpers ───────────────────────────────────────────────────────────
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
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'done' } : s)))
  }

  // ── Full pipeline: Gemini text + ElevenLabs audio in one shot ──────────────
  async function handleGenerateAudioBriefing(): Promise<void> {
    setBriefingState('generating')
    setBriefingError(null)
    setSteps(INITIAL_STEPS)

    try {
      // Step 1 — GitHub (visual only, data already loaded)
      advanceStep('github')
      await new Promise((r) => setTimeout(r, 600))
      completeStep('github')

      // Step 2 — Google Calendar (visual only)
      advanceStep('google')
      await new Promise((r) => setTimeout(r, 500))
      completeStep('google')

      // Step 3 — Gemini text generation
      advanceStep('gemini')
      const generateRes = await fetch('/api/briefing/generate', { method: 'POST' })
      if (!generateRes.ok) throw new Error('Failed to generate briefing')
      const generated = (await generateRes.json()) as DailyBriefing
      setBriefingContent(generated.content)
      completeStep('gemini')

      // Step 4 — ElevenLabs audio
      advanceStep('audio')
      const audioRes = await fetch('/api/briefing/audio', { method: 'POST' })
      if (!audioRes.ok) throw new Error('Failed to generate audio')
      const audioData = (await audioRes.json()) as { audioUrl: string }
      setAudioUrl(audioData.audioUrl)
      completeStep('audio')

      setBriefingState('ready')
    } catch (err) {
      console.error('Briefing generation error:', err)
      setBriefingError(err instanceof Error ? err.message : 'Something went wrong')
      setBriefingState('error')
    }
  }

  // ── Derived stats (from directly loaded sources, not from briefing) ────────
  const totalMeetingMins = google?.totalMeetingMinutes ?? 0
  const meetingHours = totalMeetingMins > 0
    ? totalMeetingMins >= 60
      ? `${(totalMeetingMins / 60).toFixed(1).replace('.0', '')} hrs`
      : `${totalMeetingMins} min`
    : null
  const meetingCount = google?.events.length ?? 0
  const openPRs = github?.openPRs.length ?? 0
  const conflicts = overlaps.filter((o) => o.type === 'conflict').length
  const synergies = overlaps.filter((o) => o.type === 'synergy').length
  const mergedPRs = github?.mergedPRs.length ?? 0

  const userInitials = session?.user?.name
    ? session.user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U'

  // ── Loading spinner ────────────────────────────────────────────────────────
  if (sessionStatus === 'loading' || pageState === 'loading') {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" role="status" aria-label="Loading" />
      </div>
    )
  }

  // ── Error view ─────────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '3rem 1.5rem' }}>
        <Logo />
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', marginTop: '2rem' }}>
          <p style={{ fontSize: '14px', color: '#DC2626' }}>{pageError ?? 'Something went wrong'}</p>
          <button
            type="button"
            onClick={() => { setPageState('loading'); void loadDashboard() }}
            style={{ padding: '8px 20px', background: 'var(--color-text-primary)', color: '#fff', border: 'none', borderRadius: 'var(--border-radius-md)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', minHeight: '44px' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Ready view — full dashboard always rendered ────────────────────────────
  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <Logo />
        <nav style={{ display: 'flex', gap: '4px' }} aria-label="Dashboard navigation">
          <Link href="/dashboard" style={{ padding: '5px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', background: pathname === '/dashboard' ? 'var(--pulse-green)' : 'none', color: pathname === '/dashboard' ? '#fff' : 'var(--color-text-secondary)', border: pathname === '/dashboard' ? 'none' : '0.5px solid var(--color-border-tertiary)' }}>My briefing</Link>
          <Link href="/dashboard/team" style={{ padding: '5px 14px', borderRadius: '100px', fontSize: '13px', fontWeight: 500, textDecoration: 'none', background: pathname === '/dashboard/team' ? 'var(--pulse-green)' : 'none', color: pathname === '/dashboard/team' ? '#fff' : 'var(--color-text-secondary)', border: pathname === '/dashboard/team' ? 'none' : '0.5px solid var(--color-border-tertiary)' }}>Team</Link>
        </nav>
        <div aria-label={session?.user?.name ?? 'User'} style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--color-background-info)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 500, color: 'var(--color-text-info)', flexShrink: 0 }}>
          {userInitials}
        </div>
      </header>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem', marginBottom: '1rem' }}>

        {/* Briefing card — player when audio ready, otherwise action card */}
        {briefingState === 'ready' && briefingContent && audioUrl ? (
          <ErrorBoundary>
            <BriefingPlayer audioUrl={audioUrl} transcript={briefingContent.summary} briefing={briefingContent} />
          </ErrorBoundary>
        ) : (
          <BriefingCard
            briefingState={briefingState}
            briefingError={briefingError}
            steps={steps}
            onGenerate={() => void handleGenerateAudioBriefing()}
          />
        )}

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Ask Pulse */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: '4px' }}>Ask Pulse</p>
            <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '0' }}>Ask about your work or what your teammates are up to.</p>
            <ErrorBoundary><AssistantButton /></ErrorBoundary>
          </div>

          {/* Today at a glance — populated from sources, always shown */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: '12px', padding: '1.25rem' }}>
            <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', marginBottom: '0.75rem' }}>Today at a glance</p>
            <StatRow label="Meetings" value={meetingCount > 0 ? `${meetingCount}${meetingHours ? ` · ${meetingHours}` : ''}` : '—'} tone={meetingCount >= 4 ? 'warn' : 'neutral'} />
            <Divider />
            <StatRow label="Open PRs" value={openPRs > 0 ? String(openPRs) : '—'} tone="neutral" />
            <Divider />
            <StatRow label="Team conflicts" value={conflicts > 0 ? String(conflicts) : '—'} tone={conflicts > 0 ? 'danger' : 'neutral'} />
            <Divider />
            <StatRow label="Synergies" value={synergies > 0 ? String(synergies) : '—'} tone={synergies > 0 ? 'good' : 'neutral'} />
            <Divider />
            <StatRow label="Merged yesterday" value={mergedPRs > 0 ? `${mergedPRs} PR${mergedPRs > 1 ? 's' : ''}` : '—'} tone={mergedPRs > 0 ? 'good' : 'neutral'} />
          </div>
        </div>
      </div>

      {/* Team overlaps — populated from sources, always shown when present */}
      {overlaps.length > 0 && (
        <section aria-labelledby="overlaps-heading">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <p id="overlaps-heading" style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', margin: 0 }}>Team overlaps</p>
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', background: 'var(--color-background-secondary)', padding: '2px 8px', borderRadius: '100px', border: '0.5px solid var(--color-border-tertiary)' }}>{overlaps.length} detected today</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {overlaps.map((overlap) => <InlineOverlapAlert key={overlap.id} overlap={overlap} />)}
          </div>
        </section>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Logo(): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--pulse-green)', flexShrink: 0 }} aria-hidden="true" />
      <span style={{ fontSize: '17px', fontWeight: 500, color: 'var(--color-text-primary)' }}>Pulse</span>
    </div>
  )
}

function StepDot({ status }: { status: StepStatus }): JSX.Element {
  const base: React.CSSProperties = { width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  if (status === 'done') return (
    <div style={{ ...base, background: 'var(--pulse-green-light)', border: '1px solid var(--pulse-green-mid)' }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--pulse-green-dark)" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
  )
  if (status === 'active') return (
    <div style={{ ...base, background: 'var(--pulse-green)' }}>
      <div aria-label="Loading" style={{ width: '8px', height: '8px', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
    </div>
  )
  return <div style={{ ...base, background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)' }} />
}

// ── Briefing card ─────────────────────────────────────────────────────────────
// Single card that handles: idle (show button), generating (inline steps), error

function BriefingCard({
  briefingState,
  briefingError,
  steps,
  onGenerate,
}: {
  briefingState: BriefingState
  briefingError: string | null
  steps: GeneratingStep[]
  onGenerate: () => void
}): JSX.Element {
  const isGenerating = briefingState === 'generating'
  const isError = briefingState === 'error'

  return (
    <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Label */}
      <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-tertiary)', margin: 0 }}>
        Today&apos;s briefing
      </p>

      {/* Generating: inline step progress */}
      {isGenerating ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {steps.map((step) => (
            <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <StepDot status={step.status} />
              <div>
                <p style={{ fontSize: '12px', fontWeight: step.status === 'active' ? 500 : 400, color: step.status === 'active' ? 'var(--color-text-primary)' : step.status === 'done' ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)', margin: 0, lineHeight: 1.3 }}>{step.label}</p>
                <p style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', margin: 0, lineHeight: 1.3 }}>{step.sub}</p>
              </div>
            </div>
          ))}
          <p style={{ fontSize: '12px', color: 'var(--color-text-tertiary)', margin: 0 }}>Ready in about 20 seconds</p>
        </div>
      ) : (
        /* Idle / error: description + button */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {isError && briefingError ? (
            <p role="alert" style={{ fontSize: '13px', color: '#DC2626', margin: 0 }}>{briefingError}</p>
          ) : (
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Generate your personalized audio briefing — a spoken summary of your commits, pull requests, meetings, and team activity.
            </p>
          )}

          <button
            type="button"
            onClick={onGenerate}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px 16px', background: 'var(--pulse-green)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px', width: '100%' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
            {isError ? 'Retry audio briefing' : 'Generate audio briefing'}
          </button>
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'warn' | 'good' | 'danger' }): JSX.Element {
  const valueColor = tone === 'warn' ? '#BA7517' : tone === 'good' ? '#0F6E56' : tone === 'danger' ? '#A32D2D' : 'var(--color-text-primary)'
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
  const isConflict = overlap.type === 'conflict'
  const isSynergy  = overlap.type === 'synergy'

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
  const repoLabel = overlap.repos.length > 1 ? `${overlap.repos.length} repos` : overlap.repos[0] ?? ''

  return (
    <div role="alert" style={{ borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', gap: '12px', alignItems: 'flex-start', ...cardStyle }}>
      <div aria-hidden="true" style={{ width: '28px', height: '28px', borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
        {isConflict && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
        {isSynergy && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
        {!isConflict && !isSynergy && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={iconStroke} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: titleColor, marginBottom: '3px' }}>{typeLabel} · {overlap.reason.split('—')[0]?.trim() ?? overlap.reason}</p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{overlap.detail || overlap.reason}</p>
        <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '100px', ...tagStyle }}>{typeLabel}</span>
          {repoLabel && <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '100px', background: 'var(--color-background-secondary)', color: 'var(--color-text-secondary)', border: '0.5px solid var(--color-border-tertiary)' }}>{repoLabel}</span>}
        </div>
      </div>
    </div>
  )
}
