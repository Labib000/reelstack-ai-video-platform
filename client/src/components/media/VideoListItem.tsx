import type { VideoSummaryDTO } from '@reelstack/shared'
import { XIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/format'
import { timeAgo } from '@/lib/userAgent'

import Poster from './Poster'

/** A video as a horizontal row: poster, title, channel, summary. Used by History and saved lists. */
export default function VideoListItem({
  video,
  progress,
  onRemove,
  removeLabel = 'Remove',
}: {
  video: VideoSummaryDTO
  progress?: number
  onRemove?: () => void
  removeLabel?: string
}) {
  const t = progress ? Math.round(progress * video.durationSec) : 0
  return (
    <motion.li layout exit={{ opacity: 0, x: -20 }} className="group relative flex list-none gap-3 rounded-2xl p-2 transition-colors hover:bg-accent/60 sm:gap-4">
      <Link to={`/watch/${video.id}${t ? `?t=${t}` : ''}`} className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-xl sm:w-60">
        <Poster seed={video.id} title={video.title} label={video.category} thumbnailUrl={video.thumbnailUrl} className="size-full" />
        <span className="absolute right-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums">{formatDuration(video.durationSec)}</span>
        {progress !== undefined && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25">
            <span className="block h-full bg-brand" style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </Link>
      <div className="min-w-0 flex-1 py-1 pr-8">
        <Link to={`/watch/${video.id}`} className="line-clamp-2 leading-snug font-medium hover:underline sm:text-lg">
          {video.title}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          <Link to={`/channel/${video.channel.id}`} className="hover:text-foreground">
            {video.channel.name}
          </Link>{' '}
          · {timeAgo(video.createdAt)}
        </p>
        {video.summary && <p className="mt-2 line-clamp-2 hidden text-sm text-muted-foreground sm:block">{video.summary}</p>}
      </div>
      {onRemove && (
        <Button variant="ghost" size="icon" aria-label={`${removeLabel}: ${video.title}`} onClick={onRemove} className="absolute top-2 right-2 opacity-60 group-hover:opacity-100">
          <XIcon />
        </Button>
      )}
    </motion.li>
  )
}

export function VideoListItemSkeleton() {
  return (
    <li className="flex list-none gap-4 p-2">
      <Skeleton className="aspect-video w-40 shrink-0 rounded-xl sm:w-60" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </li>
  )
}
