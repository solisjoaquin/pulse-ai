import React from 'react'

interface SourceCardProps {
  name: string
  description: string
  icon: React.ReactNode
  isConnected: boolean
  onConnect: () => void
  onDisconnect: () => void
}

export default function SourceCard({
  name,
  description,
  icon,
  isConnected,
  onConnect,
  onDisconnect,
}: SourceCardProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      {/* Left: icon + text */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-2xl">
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{name}</span>
            {isConnected ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                Not connected
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        </div>
      </div>

      {/* Action button: full width on mobile, auto on desktop */}
      <div className="flex sm:shrink-0">
        {isConnected ? (
          <button
            type="button"
            onClick={onDisconnect}
            className="min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 sm:w-auto"
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="min-h-[44px] w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 sm:w-auto"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  )
}
