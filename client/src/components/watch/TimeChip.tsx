import { PlayIcon } from 'lucide-react'

import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

/** A clickable [mm:ss] that seeks the player. */
export default function TimeChip({
  seconds,
  onSeek,
  className,
}: {
  seconds: number
  onSeek: (seconds: number) => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onSeek(seconds)}
      aria-label={`Jump to ${formatDuration(seconds)}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs font-medium text-link tabular-nums transition-colors hover:bg-primary/25 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    >
      <PlayIcon className="size-2.5 fill-current" />
      {formatDuration(seconds)}
    </button>
  )
}
