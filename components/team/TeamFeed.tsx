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
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
      aria-hidden="true"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--color-background-tertiary)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: '12px', width: '80px', borderRadius: '4px', background: 'var(--color-background-tertiary)', marginBottom: '6px' }} />
          <div style={{ height: '10px', width: '40px', borderRadius: '4px', background: 'var(--color-background-tertiary)' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ height: '11px', width: '100%', borderRadius: '4px', background: 'var(--color-background-tertiary)' }} />
        <div style={{ height: '11px', width: '75%', borderRadius: '4px', background: 'var(--color-background-tertiary)' }} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px',
            border: '1px dashed var(--color-border-tertiary)',
            background: 'var(--color-background-secondary)',
            padding: '4rem 1rem',
          }}
        >
          <p style={{ fontSize: '13px', color: 'var(--color-text-tertiary)' }}>No team members yet</p>
        </div>
      </section>
    )
  }

  const sorted = sortMembers(members, activities)

  return (
    <section aria-label="Team activity feed">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {sorted.map(({ member, activity }) => (
          <MemberCard key={member.userId} member={member} activity={activity} />
        ))}
      </div>
    </section>
  )
}
