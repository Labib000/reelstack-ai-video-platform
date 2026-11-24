import type { ChapterDTO } from '@reelstack/shared'

import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export default function ChaptersPanel({ chapters, time, onSeek }: { chapters: ChapterDTO[]; time: number; onSeek: (seconds: number) => void }) {
  const active = [...chapters].reverse().find((c) => c.start <= time)?.start
  return (
    <ol className="h-full space-y-1 overflow-y-auto p-3">
      {chapters.map((c, i) => (
        <li key={c.start}>
          <button
            type="button"
            onClick={() => onSeek(c.start)}
            aria-current={c.start === active ? 'true' : undefined}
            className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent', c.start === active && 'bg-primary/10 text-foreground')}
          >
            <span className={cn('font-display text-lg font-semibold tabular-nums', c.start === active ? 'text-brand' : 'text-muted-foreground')}>{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{c.title}</span>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">{formatDuration(c.start)}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}
