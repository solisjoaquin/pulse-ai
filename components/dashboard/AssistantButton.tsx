'use client'

import { useState, useRef, useCallback } from 'react'

type AssistantState = 'idle' | 'connecting' | 'active' | 'summary'

interface SessionSummary {
  questionsAsked: number
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
      // Get signed URL from our API
      const res = await fetch('/api/assistant/session', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to initialize voice assistant')

      const data = (await res.json()) as { signedUrl: string }

      // Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true })

      // Connect to ElevenLabs via WebSocket using the signed URL
      const ws = new WebSocket(data.signedUrl)
      wsRef.current = ws
      startTimeRef.current = Date.now()

      ws.onopen = (): void => {
        setState('active')
      }

      ws.onclose = (): void => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000)
        setSummary({ questionsAsked: 0, sessionDuration: duration })
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

  return (
    <div className="flex flex-col items-center gap-3">
      {state === 'idle' && (
        <>
          <button
            type="button"
            onClick={() => void startSession()}
            className="flex min-h-[44px] items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            {/* Mic icon */}
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            Ask Pulse
          </button>
          {error && (
            <p role="alert" className="text-center text-xs text-red-600">
              {error}
            </p>
          )}
        </>
      )}

      {state === 'connecting' && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div
            className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"
            role="status"
            aria-label="Connecting..."
          />
          Connecting...
        </div>
      )}

      {state === 'active' && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            {/* Pulsing indicator */}
            <span className="relative flex h-3 w-3" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <span className="text-sm font-medium text-gray-700">Listening...</span>
          </div>
          <button
            type="button"
            onClick={stopSession}
            className="min-h-[44px] rounded-full border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            Stop
          </button>
        </div>
      )}

      {state === 'summary' && summary && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-gray-600">
            Session ended after {summary.sessionDuration} seconds.
          </p>
          <button
            type="button"
            onClick={reset}
            className="min-h-[44px] rounded-full bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            Ask again
          </button>
        </div>
      )}
    </div>
  )
}
