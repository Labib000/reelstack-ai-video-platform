/**
 * Parked for the "Study room" (signed-in reading mode, planned for later):
 * the transcript laid out as an article. Not routed anywhere yet.
 */
import type { ChapterDTO, TranscriptSegment } from '@reelstack/shared'
import { useEffect, useMemo, useRef } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The transcript laid out as an article: chapters are numbered headings,
 * each spoken line a paragraph with its timestamp in the margin. The line
 * being spoken is marked, and the page follows it while `follow` is on.
 */
export default function TranscriptArticle({
  chapters,
  segments,
  time,
  follow,
  onSeek,
}: {
  chapters: ChapterDTO[]
  segments: TranscriptSegment[] | null
  time: number
  follow: boolean
  onSeek: (seconds: number) => void
}) {
  const activeRef = useRef<HTMLButtonElement>(null)
  const active = segments?.find((s) => time >= s.start && time < s.end)?.start

  const sections = useMemo(
    () =>
      chapters.map((c, i) => {
        const end = chapters[i + 1]?.start ?? Infinity
        return { ...c, lines: (segments ?? []).filter((s) => s.start >= c.start && s.start < end) }
      }),
    [chapters, segments],
  )

  useEffect(() => {
    if (follow) activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [active, follow])

  if (segments === null) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    )
  }

  return (
    <article className="space-y-12">
      {sections.map((section, i) => (
        <section key={section.start} aria-labelledby={`chapter-${i}`}>
          <h2 id={`chapter-${i}`} className="mb-4 flex items-baseline gap-3 font-display">
            <span className="text-sm text-brand tabular-nums">{String(i + 1).padStart(2, '0')}</span>
            <span className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{section.title}</span>
          </h2>
          <div className="space-y-1">
            {section.lines.map((line) => {
              const isActive = line.start === active
              const isPast = active !== undefined && line.end <= active + 0.001 && !isActive
              return (
                <button
                  key={line.start}
                  ref={isActive ? activeRef : undefined}
                  type="button"
                  onClick={() => onSeek(line.start)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'relative grid w-full scroll-mt-40 grid-cols-[3.25rem_minmax(0,1fr)] gap-3 rounded-xl py-2 pr-3 text-left transition-colors duration-500 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-4',
                    isActive ? 'bg-brand/[0.08] text-foreground' : 'text-foreground/80 hover:bg-accent/60 hover:text-foreground',
                    isPast && 'text-foreground/55',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-brand transition-opacity duration-500', isActive ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className={cn('pt-1 pl-3 font-mono text-xs tabular-nums', isActive ? 'text-link' : 'text-muted-foreground')}>
                    {formatDuration(line.start)}
                  </span>
                  <span className="text-[17px] leading-relaxed sm:text-lg">{line.text}</span>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </article>
  )
}
