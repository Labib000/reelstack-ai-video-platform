import type { VideoSummaryDTO } from '@reelstack/shared'
import { CheckIcon, ClockIcon, PlayIcon, SparklesIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { useLibrary } from '@/hooks/use-library'
import { formatDuration } from '@/lib/format'
import { timeAgo } from '@/lib/userAgent'
import { cn } from '@/lib/utils'

import Poster from './Poster'

/**
 * A video as a tilted screen, the shape of the ReelStack mark. On hover or
 * focus it turns to face you and shows its AI summary; the clock saves it
 * for later.
 */
export default function VideoCard({
  video,
  progress,
  tilt = true,
  className,
}: {
  video: VideoSummaryDTO
  progress?: number
  tilt?: boolean
  className?: string
}) {
  const lib = useLibrary()
  const saved = lib.has('watchLater', video.id)

  return (
    <div className={cn('group relative', className)}>
      <Link to={`/watch/${video.id}`} className="block rounded-xl outline-none">
        <motion.div
          className="relative aspect-video overflow-hidden rounded-xl shadow-lg shadow-black/25 ring-1 ring-white/5 group-focus-within:ring-2 group-focus-within:ring-ring"
          style={{ transformPerspective: 1000 }}
          initial={false}
          animate={{ rotateY: tilt ? 12 : 0 }}
          whileHover={{ rotateY: 0, scale: 1.03, y: -3 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          <Poster seed={video.id} title={video.title} label={video.category} thumbnailUrl={video.thumbnailUrl} className="size-full" />
          <span className="absolute right-2 bottom-2 rounded-md bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums transition-opacity group-hover:opacity-0">
            {formatDuration(video.durationSec)}
          </span>

          {/* Hover / focus: what the video is about, then play. */}
          <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/55 to-black/10 p-3.5 text-white opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
            <span className="absolute top-1/2 left-1/2 flex size-11 -translate-x-1/2 -translate-y-[70%] items-center justify-center rounded-full bg-primary shadow-lg">
              <PlayIcon className="ml-0.5 size-5 fill-current" />
            </span>
            {video.summary && (
              <span className="flex gap-1.5 text-xs leading-snug text-white/90">
                <SparklesIcon className="mt-0.5 size-3 shrink-0 text-brand" />
                <span className="line-clamp-2">{video.summary}</span>
              </span>
            )}
          </span>

          {progress !== undefined && (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
              <span className="block h-full bg-brand" style={{ width: `${Math.round(progress * 100)}%` }} />
            </span>
          )}
        </motion.div>
        <div className="mt-3 px-0.5">
          <p className="line-clamp-2 leading-snug font-medium">{video.title}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{video.channel.name}</p>
          <p className="text-xs text-muted-foreground/80">
            {formatDuration(video.durationSec)} · {timeAgo(video.createdAt)}
          </p>
        </div>
      </Link>

      <button
        type="button"
        onClick={() => lib.toggle('watchLater', video.id)}
        aria-label={saved ? 'Remove from Watch later' : 'Save to Watch later'}
        aria-pressed={saved}
        className={cn(
          'absolute top-2 right-2 z-10 flex size-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-opacity hover:bg-black/90 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none',
          saved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        )}
      >
        {saved ? <CheckIcon className="size-4" /> : <ClockIcon className="size-4" />}
      </button>
    </div>
  )
}

export function VideoCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="aspect-video rounded-xl" />
      <Skeleton className="mt-3 h-4 w-4/5" />
      <Skeleton className="mt-2 h-3 w-1/2" />
    </div>
  )
}
