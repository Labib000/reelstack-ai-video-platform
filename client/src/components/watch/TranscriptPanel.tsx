import type { TranscriptSegment } from '@reelstack/shared'
import { SearchIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/format'
import { scrollWithin } from '@/lib/scroll'
import { cn } from '@/lib/utils'

/** Lines scroll with playback like lyrics; click one to jump there. */
export default function TranscriptPanel({ segments, time, onSeek }: { segments: TranscriptSegment[] | null; time: number; onSeek: (seconds: number) => void }) {
  const [filter, setFilter] = useState('')
  const activeRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const active = segments?.find((s) => time >= s.start && time < s.end)?.start

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return f ? (segments ?? []).filter((s) => s.text.toLowerCase().includes(f)) : (segments ?? [])
  }, [segments, filter])

  useEffect(() => {
    if (!filter) scrollWithin(listRef.current, activeRef.current)
  }, [active, filter])

  return (
    <div className="flex h-full flex-col">
      <div className="relative border-b border-glass-border p-3">
        <SearchIcon className="absolute top-1/2 left-6 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search the transcript" aria-label="Search the transcript" className="bg-background/50 pl-9" />
      </div>
      <div ref={listRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {segments === null
          ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)
          : shown.map((s) => {
              const isActive = s.start === active
              return (
                <button
                  key={s.start}
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => onSeek(s.start)}
                  className={cn('flex w-full gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent', isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground')}
                >
                  <span className={cn('font-mono text-xs tabular-nums', isActive && 'text-link')}>{formatDuration(s.start)}</span>
                  <span className={cn('leading-relaxed', isActive && 'font-medium')}>{s.text}</span>
                </button>
              )
            })}
        {segments && shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No lines match.</p>}
      </div>
    </div>
  )
}
