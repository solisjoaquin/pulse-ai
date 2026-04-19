import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import OnboardingFlow from '@/components/onboarding/OnboardingFlow'

export default async function OnboardingSourcesPage(): Promise<React.ReactElement> {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-16">
      {/* Logo / brand */}
      <div className="mb-10 flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 fill-white"
            aria-hidden="true"
          >
            <path d="M3 12h2v4H3v-4zm4-4h2v12H7V8zm4-4h2v16h-2V4zm4 4h2v12h-2V8zm4 4h2v4h-2v-4z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Pulse</h1>
        <p className="text-sm text-gray-500">Your voice-first daily briefing</p>
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
          1
        </div>
        <span className="text-sm font-medium text-gray-900">Connect sources</span>
        <div className="h-px w-8 bg-gray-300" />
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-500">
          2
        </div>
        <span className="text-sm text-gray-400">Set up team</span>
      </div>

      {/* Onboarding wizard */}
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-1 text-xl font-semibold text-gray-900">
          Connect your data sources
        </h2>
        <p className="mb-6 text-sm text-gray-500">
          Connect at least one account so Pulse can build your personalized briefing.
        </p>
        <OnboardingFlow redirectTo="/onboarding/team" />
      </div>
    </main>
  )
}
