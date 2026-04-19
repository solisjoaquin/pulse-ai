'use client'

import { useState, useRef, useCallback } from 'react'

type AssistantState = 'idle' | 'connecting' | 'active' | 'summary'

interface SessionSummary {
  sessionDuration: number // seconds
}

export default function AssistantButton(): JSX.Element {
  const [state, setState] = useState<AssistantState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const startTimeRef = useRef<number>(0)

  const startSession = useCallback(async (): Promise<void> => {
    setState('connecting')
    setError(null)

    try {
      const res = await fetch('/api/assistant/session', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to initialize voice assistant')

      const data = (await res.json()) as { signedUrl: string }

      await navigator.mediaDevices.getUserMedia({ audio: true })

      const ws = new WebSocket(data.signedUrl)
      wsRef.current = ws
      startTimeRef.current = Date.now()

      ws.onopen = (): void => setState('active')

      ws.onclose = (): void => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
        setSummary({ sessionDuration: duration })
        setState('summary')
        wsRef.current = null
      }

      ws.onerror = (): void => {
        setError('Voice session encountered an error')
        setState('idle')
        wsRef.current = null
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow mic access and try again.')
      } else {
        setError(err instanceof Error ? err.message : 'Failed to start voice session')
      }
      setState('idle')
    }
  }, [])

  function stopSession(): void {
    wsRef.current?.close()
  }

  function reset(): void {
    setState('idle')
    setSummary(null)
    setError(null)
  }

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          onClick={() => void startSession()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: 'none',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            fontSize: '13px',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            width: '100%',
            justifyContent: 'center',
            minHeight: '44px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pulse-green)" strokeWidth="2" aria-hidden="true">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
          Start voice session
        </button>
        {error && (
          <p role="alert" style={{ fontSize: '12px', color: '#DC2626', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    )
  }

  // ── Connecting ────────────────────────────────────────────────────────────
  if (state === 'connecting') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        <div
          role="status"
          aria-label="Connecting..."
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: '1.5px solid var(--color-border-primary)',
            borderTopColor: 'var(--pulse-green)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        Connecting...
      </div>
    )
  }

  // ── Active ────────────────────────────────────────────────────────────────
  if (state === 'active') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
        {/* Mic ring */}
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            border: '1.5px solid var(--pulse-green)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'var(--pulse-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--pulse-green-dark)', marginBottom: '4px' }}>
            Listening...
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
            Pulse is ready for your question
          </p>
        </div>

        {/* Waveform bars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }} aria-hidden="true">
          {[8, 20, 32, 24, 14, 28, 10].map((h, i) => (
            <div
              key={i}
              style={{
                width: '3px',
                height: `${h}px`,
                borderRadius: '2px',
                background: 'var(--pulse-green)',
                opacity: 0.4 + (h / 32) * 0.6,
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={stopSession}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            background: 'none',
            border: '0.5px solid var(--color-border-secondary)',
            borderRadius: 'var(--border-radius-md)',
            fontSize: '13px',
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-text-secondary)" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
          </svg>
          End session
        </button>
      </div>
    )
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
      <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        Session ended{summary ? ` · ${summary.sessionDuration}s` : ''}.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          background: 'none',
          border: '0.5px solid var(--color-border-secondary)',
          borderRadius: 'var(--border-radius-md)',
          fontSize: '13px',
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pulse-green)" strokeWidth="2" aria-hidden="true">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
        Start new session
      </button>
    </div>
  )
}
