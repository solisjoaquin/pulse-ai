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

export default function DashboardPage() {
  const { status: sessionStatus } = useSession()
  const router = useRouter()

  const [state, setState] = useState<PageState>('loading')
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace('/login')
    }
  }, [sessionStatus, router])

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      void loadBriefing()
    }
  }, [sessionStatus])

  async function loadBriefing(): Promise<void> {
    try {
      // Check if a briefing already exists for today
      const statusRes = await fetch('/api/briefing/status')
      if (!statusRes.ok) throw new Error('Failed to check briefing status')

      const statusData = await statusRes.json() as { status: string; briefing?: DailyBriefing }

      if (statusData.status === 'ready' && statusData.briefing) {
        setBriefing(statusData.briefing)
        setState('ready')
        return
      }

      // No cached briefing — generate one
      setState('generating')
      const generateRes = await fetch('/api/briefing/generate', { method: 'POST' })
      if (!generateRes.ok) throw new Error('Failed to generate briefing')

      const generated = await generateRes.json() as DailyBriefing
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
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Don't render anything while session is loading
  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
            {/* Pulse waveform icon */}
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden="true">
              <path d="M3 12h2v4H3v-4zm4-4h2v12H7V8zm4-4h2v16h-2V4zm4 4h2v12h-2V8zm4 4h2v4h-2v-4z" />
            </svg>
          </div>
          <span className="text-lg font-semibold text-gray-900">Pulse</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-gray-500 sm:block">{today}</span>
          {briefing && <SourceStatus sources={briefing.sources} />}
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        )}

        {state === 'generating' && (
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            <p className="text-sm text-gray-500">Generating your briefing...</p>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-red-600">{error ?? 'Something went wrong'}</p>
            <button
              type="button"
              onClick={() => {
                setState('loading')
                void loadBriefing()
              }}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {state === 'ready' && briefing?.content && briefing.audioUrl && (
          <div className="flex w-full max-w-2xl flex-col gap-8">
            {/* Player zone */}
            <ErrorBoundary>
              <BriefingPlayer
                audioUrl={briefing.audioUrl}
                transcript={briefing.content.summary}
              />
            </ErrorBoundary>
          </div>
        )}
      </main>

      {/* Assistant zone */}
      {state === 'ready' && (
        <footer className="flex justify-center border-t border-gray-200 bg-white px-6 py-6">
          <ErrorBoundary>
            <AssistantButton />
          </ErrorBoundary>
        </footer>
      )}
    </div>
  )
}
