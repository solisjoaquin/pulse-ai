'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Team } from '@/types'

type Mode = 'choose' | 'create' | 'join'

interface TeamOnboardingFlowProps {
  prefillToken?: string
}

export default function TeamOnboardingFlow({
  prefillToken = '',
}: TeamOnboardingFlowProps): React.ReactElement {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(prefillToken ? 'join' : 'choose')

  // Create flow state
  const [teamName, setTeamName] = useState('')
  const [createdTeam, setCreatedTeam] = useState<Team | null>(null)
  const [inviteLink, setInviteLink] = useState('')
  const [copied, setCopied] = useState(false)

  // Join flow state
  const [inviteToken, setInviteToken] = useState(prefillToken)

  // Shared state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // ── Create flow ────────────────────────────────────────────────────────────

  async function handleCreate(): Promise<void> {
    const name = teamName.trim()
    if (!name) {
      setError('Enter a team name to continue.')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/team/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data: { team?: Team; inviteLink?: string; error?: string } =
        await res.json()
      if (!res.ok || !data.team) {
        setError(data.error ?? 'Failed to create team. Please try again.')
        return
      }
      setCreatedTeam(data.team)
      setInviteLink(data.inviteLink ?? '')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCopyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select the text in the input
    }
  }

  function handleGoToDashboard(): void {
    router.push('/dashboard')
  }

  // ── Join flow ──────────────────────────────────────────────────────────────

  function extractToken(value: string): string {
    // Accept either a full invite URL or a raw token
    try {
      const url = new URL(value)
      return url.searchParams.get('token') ?? value
    } catch {
      return value
    }
  }

  async function handleJoin(): Promise<void> {
    const token = extractToken(inviteToken.trim())
    if (!token) {
      setError('Paste an invite link or token to continue.')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      const res = await fetch('/api/team/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteToken: token }),
      })
      const data: { team?: Team; error?: string } = await res.json()
      if (!res.ok || !data.team) {
        setError(data.error ?? 'Failed to join team. Please try again.')
        return
      }
      router.push('/dashboard')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (mode === 'choose') {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setMode('create')}
          className="flex min-h-[56px] w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
            <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1z" />
            </svg>
          </span>
          <div>
            <p className="font-semibold text-gray-900">Create a team</p>
            <p className="text-sm text-gray-500">Start a new workspace and invite your teammates.</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMode('join')}
          className="flex min-h-[56px] w-full items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 text-left transition-colors hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
            <svg viewBox="0 0 20 20" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M13 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM18 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM6 8a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM15.22 14.79A5.002 5.002 0 0 0 10 11a5.002 5.002 0 0 0-5.22 3.79A.75.75 0 0 0 5.5 16h9a.75.75 0 0 0 .72-1.21zM18 16h-1.5a2.5 2.5 0 0 0-2.45-2h-.1A6.5 6.5 0 0 1 16.5 16H18a.5.5 0 0 0 0-1h-.5a.5.5 0 0 1 0 1H18zM2 16h1.5a2.5 2.5 0 0 1 2.45-2h.1A6.5 6.5 0 0 0 3.5 16H2a.5.5 0 0 1 0-1h.5a.5.5 0 0 0 0 1H2z" />
            </svg>
          </span>
          <div>
            <p className="font-semibold text-gray-900">Join a team</p>
            <p className="text-sm text-gray-500">Use an invite link from a teammate.</p>
          </div>
        </button>
      </div>
    )
  }

  if (mode === 'create') {
    // Success state — team created, show invite link
    if (createdTeam) {
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white text-sm font-bold">
              ✓
            </span>
            <div>
              <p className="font-semibold text-green-900">
                {createdTeam.name} created
              </p>
              <p className="text-sm text-green-700">Share the invite link with your teammates.</p>
            </div>
          </div>

          <div>
            <label
              htmlFor="invite-link"
              className="mb-1.5 block text-sm font-medium text-gray-700"
            >
              Invite link
            </label>
            <div className="flex gap-2">
              <input
                id="invite-link"
                type="text"
                readOnly
                value={inviteLink}
                className="min-h-[44px] flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="min-h-[44px] shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              This link expires in 72 hours.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoToDashboard}
            className="mt-2 min-h-[44px] w-full rounded-xl bg-gray-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
          >
            Go to Dashboard
          </button>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => { setMode('choose'); setError('') }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 focus:outline-none"
          aria-label="Back to team options"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0z" clipRule="evenodd" />
          </svg>
          Back
        </button>

        <div>
          <label
            htmlFor="team-name"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Team name
          </label>
          <input
            id="team-name"
            type="text"
            value={teamName}
            onChange={(e) => { setTeamName(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
            placeholder="e.g. Acme Engineering"
            maxLength={100}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            autoFocus
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={isLoading || !teamName.trim()}
          className="min-h-[44px] w-full rounded-xl bg-gray-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? 'Creating…' : 'Create Team'}
        </button>
      </div>
    )
  }

  // mode === 'join'
  return (
    <div className="flex flex-col gap-4">
      {!prefillToken && (
        <button
          type="button"
          onClick={() => { setMode('choose'); setError('') }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 focus:outline-none"
          aria-label="Back to team options"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current" aria-hidden="true">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 0 1 0 1.414L9.414 10l3.293 3.293a1 1 0 0 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414l4-4a1 1 0 0 1 1.414 0z" clipRule="evenodd" />
          </svg>
          Back
        </button>
      )}

      <div>
        <label
          htmlFor="invite-token"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Invite link or token
        </label>
        <input
          id="invite-token"
          type="text"
          value={inviteToken}
          onChange={(e) => { setInviteToken(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleJoin() }}
          placeholder="Paste your invite link here"
          className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          autoFocus={!prefillToken}
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void handleJoin()}
        disabled={isLoading || !inviteToken.trim()}
        className="min-h-[44px] w-full rounded-xl bg-gray-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? 'Joining…' : 'Join Team'}
      </button>
    </div>
  )
}
