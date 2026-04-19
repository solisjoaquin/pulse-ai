import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getCachedBriefing } from '@/lib/cache/briefing'
import type { DailyBriefing } from '@/types'

type StatusReadyResponse = { status: 'ready'; briefing: DailyBriefing }
type StatusPendingResponse = { status: 'pending' }
type ErrorResponse = { error: string }

export async function GET(): Promise<
  NextResponse<StatusReadyResponse | StatusPendingResponse | ErrorResponse>
> {
  const isDemoMode = process.env.DEMO_MODE === 'true'

  const session = await auth()
  if (!isDemoMode && !session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId: string = isDemoMode ? 'demo-user' : (session!.user!.id as string)
  const today = new Date().toISOString().split('T')[0]

  const briefing = await getCachedBriefing(userId, today)

  if (briefing) {
    return NextResponse.json({ status: 'ready', briefing })
  }

  return NextResponse.json({ status: 'pending' })
}
