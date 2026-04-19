import type { TeamMember, MemberActivity } from '@/types'

interface MemberCardProps {
  member: TeamMember
  activity: MemberActivity | null
}

interface AvatarProps {
  name: string
  avatarUrl: string
}

// Deterministic color palette for avatars without images
const AVATAR_COLORS: { bg: string; color: string }[] = [
  { bg: '#EEEDFE', color: '#3C3489' },
  { bg: '#FAEEDA', color: '#854F0B' },
  { bg: '#FAECE7', color: '#993C1D' },
  { bg: 'var(--color-background-info)', color: 'var(--color-text-info)' },
]

function getAvatarColor(name: string): { bg: string; color: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!
}

function Avatar({ name, avatarUrl }: AvatarProps): React.ReactElement {
  const initials = name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={`${name}'s avatar`}
        style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        width={28}
        height={28}
      />
    )
  }

  const { bg, color } = getAvatarColor(name)

  return (
    <div
      aria-label={`${name}'s avatar`}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 500,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

export default function MemberCard({ member, activity }: MemberCardProps): React.ReactElement {
  const focusSummary = activity?.focusSummary ?? null
  const repos = activity?.touchedRepos ?? []
  const isActive = activity !== null

  return (
    <article
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: '12px',
        padding: '1rem',
      }}
    >
      {/* Header: avatar + name + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Avatar name={member.name} avatarUrl={member.avatarUrl} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: '1px' }}>
            {member.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span
              aria-hidden="true"
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isActive ? '#1D9E75' : 'var(--color-text-tertiary)',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
              {isActive ? 'active' : 'no activity'}
            </span>
          </div>
        </div>
      </div>

      {/* Focus summary */}
      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '8px' }}>
        {focusSummary ?? 'No recent activity'}
      </p>

      {/* Repo pills */}
      {repos.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {repos.map((repo) => (
            <span
              key={repo}
              style={{
                display: 'inline-block',
                fontSize: '11px',
                padding: '2px 8px',
                background: 'var(--color-background-secondary)',
                border: '0.5px solid var(--color-border-tertiary)',
                borderRadius: '100px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {repo}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
