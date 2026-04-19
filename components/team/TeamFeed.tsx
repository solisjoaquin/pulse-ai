import type { TeamMember, MemberActivity } from '@/types'
import MemberCard from './MemberCard'

interface TeamFeedProps {
  members: TeamMember[]
  activities: MemberActivity[]
  isLoading?: boolean
}

/** Number of skeleton cards to show while loading */
const SKELETON_COUNT = 6

function MemberCardSkeleton(): React.ReactElement {
  return (
    <div
      className="flex w-full animate-pulse flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      aria-hidden="true"
    >
      {/* Header: avatar + name + dots */}
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            {/* Name */}
            <div className="h-4 w-32 rounded bg-gray-200" />
            {/* Connection dots */}
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-gray-200" />
              <div className="h-2 w-2 rounded-full bg-gray-200" />
              <div className="h-2 w-2 rounded-full bg-gray-200" />
            </div>
          </div>
          {/* Timestamp */}
          <div className="mt-1.5 h-3 w-20 rounded bg-gray-200" />
        </div>
      </div>

      {/* Focus summary lines */}
      <div className="flex flex-col gap-1.5">
        <div className="h-3.5 w-full rounded bg-gray-200" />
        <div className="h-3.5 w-4/5 rounded bg-gray-200" />
      </div>
    </div>
  )
}

/**
 * Sort members so those with recent activity come first.
 * Members without a matching MemberActivity entry are placed last.
 */
function sortMembers(
  members: TeamMember[],
  activities: MemberActivity[],
): { member: TeamMember; activity: MemberActivity | null }[] {
  const activityMap = new Map<string, MemberActivity>()
  for (const activity of activities) {
    activityMap.set(activity.userId, activity)
  }

  const active: { member: TeamMember; activity: MemberActivity }[] = []
  const inactive: { member: TeamMember; activity: null }[] = []

  for (const member of members) {
    const activity = activityMap.get(member.userId)
    if (activity !== undefined) {
      active.push({ member, activity })
    } else {
      inactive.push({ member, activity: null })
    }
  }

  return [...active, ...inactive]
}

export default function TeamFeed({
  members,
  activities,
  isLoading = false,
}: TeamFeedProps): React.ReactElement {
  if (isLoading) {
    return (
      <section aria-label="Team activity feed loading" aria-busy="true">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <MemberCardSkeleton key={i} />
          ))}
        </div>
      </section>
    )
  }

  if (members.length === 0) {
    return (
      <section aria-label="Team activity feed">
        <div className="flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16">
          <p className="text-sm text-gray-500">No team members yet</p>
        </div>
      </section>
    )
  }

  const sorted = sortMembers(members, activities)

  return (
    <section aria-label="Team activity feed">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map(({ member, activity }) => (
          <MemberCard key={member.userId} member={member} activity={activity} />
        ))}
      </div>
    </section>
  )
}
