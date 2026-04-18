'use client'

import { useRef, useState, useEffect } from 'react'

interface BriefingPlayerProps {
  audioUrl: string
  transcript: string
}

export default function BriefingPlayer({ audioUrl, transcript }: BriefingPlayerProps) {
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
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="w-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Play/Pause + Progress */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="flex flex-1 flex-col gap-1">
          {/* Progress bar */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            aria-label="Seek"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-gray-900"
          />
          {/* Time display */}
          <div className="flex justify-between text-xs text-gray-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Speed + Transcript controls */}
      <div className="mt-4 flex items-center justify-between">
        {/* Speed selector */}
        <div className="flex items-center gap-1" role="group" aria-label="Playback speed">
          {([1, 1.5, 2] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSpeedChange(s)}
              aria-pressed={speed === s}
              className={`min-h-[44px] rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 ${
                speed === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Transcript toggle */}
        <button
          type="button"
          onClick={() => setShowTranscript(!showTranscript)}
          aria-expanded={showTranscript}
          className="text-xs font-medium text-gray-500 underline-offset-2 hover:text-gray-900 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
        >
          {showTranscript ? 'Hide transcript' : 'Show transcript'}
        </button>
      </div>

      {/* Transcript panel */}
      {showTranscript && (
        <div className="mt-4 rounded-xl bg-gray-50 p-4">
          <p className="text-sm leading-relaxed text-gray-700">{transcript}</p>
        </div>
      )}
    </div>
  )
}
