'use client'

import type { DailyBriefing } from '@/types'

interface SourceStatusProps {
  sources: DailyBriefing['sources']
}

interface SourceIndicatorProps {
  name: string
  icon: React.ReactNode
  isConnected: boolean
}

function SourceIndicator({ name, icon, isConnected }: SourceIndicatorProps) {
  const tooltip = isConnected
    ? `${name}: data loaded successfully`
    : `${name}: data unavailable`

  return (
    <div
      className="group relative flex items-center gap-1.5"
      title={tooltip}
    >
      <span className="text-gray-400">{icon}</span>
      <span
        className={`h-2 w-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-yellow-400'
        }`}
        aria-label={tooltip}
      />
      {/* Tooltip */}
      <div
        role="tooltip"
        className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        {tooltip}
      </div>
    </div>
  )
}

export default function SourceStatus({ sources }: SourceStatusProps) {
  return (
    <div className="flex items-center gap-3" aria-label="Data source status">
      <SourceIndicator
        name="GitHub"
        isConnected={sources.github !== null}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        }
      />
      <SourceIndicator
        name="Google Calendar"
        isConnected={sources.google !== null}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path fill="#4285F4" d="M19.5 3h-15A1.5 1.5 0 0 0 3 4.5v15A1.5 1.5 0 0 0 4.5 21h15a1.5 1.5 0 0 0 1.5-1.5v-15A1.5 1.5 0 0 0 19.5 3zm-7 13.5c-2.485 0-4.5-2.015-4.5-4.5S10.015 7.5 12.5 7.5 17 9.515 17 12s-2.015 4.5-4.5 4.5z" />
          </svg>
        }
      />
      <SourceIndicator
        name="Jira"
        isConnected={sources.jira !== null}
        icon={
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-blue-500" aria-hidden="true">
            <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005zm5.723-5.756H5.757a5.215 5.215 0 0 0 5.214 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.762a1.005 1.005 0 0 0-1.021-1.005zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24.019 12.49V1.005A1.005 1.005 0 0 0 23.013 0z" />
          </svg>
        }
      />
    </div>
  )
}
