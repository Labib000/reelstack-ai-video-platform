import type { VideoDetailDTO } from '@reelstack/shared'
import { PauseIcon, PlayIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef } from 'react'

import Poster from '@/components/media/Poster'
import { posterBackground } from '@/components/media/poster-palette'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The theater screen. Until Phase 3 wires hls.js this is a stand-in that
 * "plays" by advancing a clock, so seeking from chapters, transcript lines
 * and Ask citations can be seen working.
 */
export default function PlayerStage({
  video,
  time,
  playing,
  onTogglePlay,
  onSeek,
  compact = false,
}: {
  compact?: boolean
  video: VideoDetailDTO
  time: number
  playing: boolean
  onTogglePlay: () => void
  onSeek: (seconds: number) => void
}) {
  const bar = useRef<HTMLDivElement>(null)
  const pct = (s: number) => `${(s / video.durationSec) * 100}%`
  const chapter = [...video.chapters].reverse().find((c) => c.start <= time)

  const seekFromPointer = (clientX: number) => {
    const rect = bar.current?.getBoundingClientRect()
    if (!rect) return
    onSeek(Math.round(((clientX - rect.left) / rect.width) * video.durationSec))
  }

  return (
    <div className="relative">
      {/* Ambilight: the screen's colours glowing onto the room. */}
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-[2rem] opacity-45 blur-3xl saturate-150 sm:-inset-8"
        style={{ background: posterBackground(video.id) }}
      />
      <div className="group relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
        <Poster seed={video.id} title={video.title} label={video.category} showTitle={false} className="size-full opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="absolute inset-0 flex items-center justify-center outline-none"
        >
          <motion.span
            animate={{ scale: playing ? 0.8 : 1, opacity: playing ? 0 : 1 }}
            className={cn('flex items-center justify-center rounded-full bg-primary/90 text-white shadow-2xl shadow-primary/40 group-hover:opacity-100', compact ? 'size-12' : 'size-20')}
          >
            {playing ? <PauseIcon className={cn('fill-current', compact ? 'size-5' : 'size-8')} /> : <PlayIcon className={cn('ml-1 fill-current', compact ? 'size-5' : 'size-8')} />}
          </motion.span>
        </button>

        <div className={cn('absolute inset-x-0 bottom-0 space-y-2 text-white', compact ? 'p-3' : 'p-4')}>
          <div className="flex items-center justify-between text-xs text-white/80">
            <span className="truncate">{chapter?.title}</span>
            <span className="font-mono tabular-nums">
              {formatDuration(time)} / {formatDuration(video.durationSec)}
            </span>
          </div>
          <div
            ref={bar}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={video.durationSec}
            aria-valuenow={time}
            aria-valuetext={formatDuration(time)}
            onClick={(e) => seekFromPointer(e.clientX)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') onSeek(Math.min(video.durationSec, time + 10))
              if (e.key === 'ArrowLeft') onSeek(Math.max(0, time - 10))
            }}
            className="relative h-1.5 cursor-pointer rounded-full bg-white/25 outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: pct(time) }} />
            {video.chapters.slice(1).map((c) => (
              <span
                key={c.start}
                title={c.title}
                className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-black/70"
                style={{ left: pct(c.start) }}
              />
            ))}
            <span
              className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
              style={{ left: pct(time) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
