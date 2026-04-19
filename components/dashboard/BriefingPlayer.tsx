'use client'

import { useRef, useState, useEffect } from 'react'

interface BriefingPlayerProps {
  audioUrl: string
  transcript: string
  briefing?: {
    summary: string
    achievements: string[]
    pending: { id: string; title: string }[]
    blockers: { id: string; title: string; description?: string }[]
    todaySchedule: { id: string; title: string; start: string; end: string; attendees: number; isVideo: boolean }[]
  }
}

export default function BriefingPlayer({ audioUrl, transcript, briefing }: BriefingPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1)
  const [showTranscript, setShowTranscript] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = (): void => setCurrentTime(audio.currentTime)
    const handleDurationChange = (): void => setDuration(audio.duration)
    const handleEnded = (): void => setIsPlaying(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  function togglePlay(): void {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      void audio.play()
    }
    setIsPlaying(!isPlaying)
  }

  function seek(delta: number): void {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + delta))
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>): void {
    const audio = audioRef.current
    if (!audio) return
    const newTime = Number(e.target.value)
    audio.currentTime = newTime
    setCurrentTime(newTime)
  }

  function handleSpeedChange(newSpeed: 1 | 1.5 | 2): void {
    const audio = audioRef.current
    if (!audio) return
    audio.playbackRate = newSpeed
    setSpeed(newSpeed)
  }

  function formatTime(seconds: number): string {
    if (!isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const durationLabel = duration > 0
    ? `${Math.floor(duration / 60)} min ${Math.floor(duration % 60)} sec`
    : '—'

  function cycleSpeed(): void {
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1
    handleSpeedChange(next)
  }

  return (
    <div
      style={{
        background: 'var(--color-background-primary)',
        border: '0.5px solid var(--color-border-tertiary)',
        borderRadius: '12px',
        padding: '1.25rem',
      }}
    >
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Label */}
      <p
        style={{
          fontSize: '11px',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--color-text-tertiary)',
          marginBottom: '0.75rem',
        }}
      >
        Today&apos;s briefing · {durationLabel}
      </p>

      {/* Summary */}
      <p
        style={{
          fontSize: '14px',
          color: 'var(--color-text-primary)',
          lineHeight: 1.6,
          marginBottom: '1rem',
        }}
      >
        {transcript}
      </p>

      {/* Progress */}
      <div style={{ marginBottom: '6px' }}>
        <div
          style={{
            height: '3px',
            background: 'var(--color-background-tertiary)',
            borderRadius: '100px',
            marginBottom: '6px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
              background: 'var(--pulse-green)',
              borderRadius: '100px',
              transition: 'width 0.1s linear',
            }}
          />
        </div>
        {/* Hidden range for accessibility */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Seek"
          className="sr-only"
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '11px',
            color: 'var(--color-text-tertiary)',
            marginBottom: '1rem',
          }}
        >
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Rewind */}
        <button
          type="button"
          onClick={() => seek(-10)}
          aria-label="Rewind 10 seconds"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M12 7v5l3 3"/>
          </svg>
        </button>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'var(--pulse-green)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <rect x="6" y="4" width="4" height="16" rx="1"/>
              <rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Forward */}
        <button
          type="button"
          onClick={() => seek(10)}
          aria-label="Forward 10 seconds"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: 'var(--color-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            borderRadius: 'var(--border-radius-md)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M12 7v5l-3 3"/>
          </svg>
        </button>

        {/* Speed — single cycling button */}
        <button
          type="button"
          onClick={cycleSpeed}
          aria-label={`Playback speed: ${speed}×. Click to change.`}
          style={{
            background: 'var(--color-background-secondary)',
            border: '0.5px solid var(--color-border-tertiary)',
            borderRadius: '100px',
            padding: '3px 10px',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          {speed}×
        </button>

        {/* Transcript toggle */}
        <button
          type="button"
          onClick={() => setShowTranscript(!showTranscript)}
          aria-expanded={showTranscript}
          style={{
            fontSize: '12px',
            color: 'var(--color-text-tertiary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {showTranscript ? 'hide transcript' : 'show transcript'}
        </button>
      </div>

      {/* Transcript panel */}
      {showTranscript && (
        <div
          style={{
            borderTop: '0.5px solid var(--color-border-tertiary)',
            marginTop: '1.25rem',
            paddingTop: '1.25rem',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.75,
            }}
          >
            {transcript}
          </p>
        </div>
      )}
    </div>
  )
}
