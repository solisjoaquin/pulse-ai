'use client'

import React, { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SourceCard from './SourceCard'

interface OnboardingFlowProps {
  /** Where to redirect after at least one source is connected. Defaults to '/dashboard'. */
  redirectTo?: string
}

export default function OnboardingFlow({
  redirectTo = '/dashboard',
}: OnboardingFlowProps): React.ReactElement {
  const { data: session } = useSession()
  const router = useRouter()
  const [showError, setShowError] = useState(false)

  const isGitHubConnected = Boolean(session?.githubAccessToken)
  const isGoogleConnected = Boolean(session?.googleAccessToken)
  const hasAtLeastOne = isGitHubConnected || isGoogleConnected

  function handleContinue(): void {
    if (!hasAtLeastOne) {
      setShowError(true)
      return
    }
    router.push(redirectTo)
  }

  function handleConnect(provider: 'github' | 'google'): void {
    setShowError(false)
    void signIn(provider)
  }

  function handleDisconnect(): void {
    setShowError(false)
    void signOut()
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-4">
      <SourceCard
        name="GitHub"
        description="Commits, pull requests, and code reviews from the last 24 hours."
        icon={
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-gray-900" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        }
        isConnected={isGitHubConnected}
        onConnect={() => handleConnect('github')}
        onDisconnect={handleDisconnect}
      />

      <SourceCard
        name="Google Calendar"
        description="Today's meetings, events, and schedule from your primary calendar."
        icon={
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path fill="#4285F4" d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12s4.48 10 10 10 10-4.48 10-10z" opacity=".1" />
            <path fill="#4285F4" d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
        }
        isConnected={isGoogleConnected}
        onConnect={() => handleConnect('google')}
        onDisconnect={handleDisconnect}
      />

      {showError && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Connect at least one data source to continue.
        </p>
      )}

      <button
        type="button"
        onClick={handleContinue}
        disabled={!hasAtLeastOne}
        className="mt-2 min-h-[44px] w-full rounded-xl bg-gray-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
      </button>
    </div>
  )
}
