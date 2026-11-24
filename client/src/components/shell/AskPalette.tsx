import type { MomentDTO, VideoSummaryDTO } from '@reelstack/shared'
import { FilmIcon, SparklesIcon } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { LogoMark } from '@/components/brand/Logo'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { searchMoments, searchVideos } from '@/data'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { formatDuration } from '@/lib/format'

import { AskPaletteContext } from './ask-palette-context'

const TRY = ['how does refresh token rotation work', 'what is an event horizon', 'why pat meat dry before searing', 'what is a match cut']

/**
 * ⌘K / Ctrl+K: "Ask anything across ReelStack". Searches *inside* videos
 * (moments with timestamps) as well as titles; picking a moment opens the
 * video at that second.
 */
export default function AskPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const debounced = useDebouncedValue(query, 200)
  const [results, setResults] = useState<{ moments: MomentDTO[]; videos: VideoSummaryDTO[] }>({ moments: [], videos: [] })
  const navigate = useNavigate()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    let cancelled = false
    const q = debounced.trim()
    if (!q) return
    Promise.all([searchMoments(q), searchVideos(q)]).then(([moments, videos]) => {
      if (!cancelled) setResults({ moments, videos: videos.slice(0, 4) })
    })
    return () => {
      cancelled = true
    }
  }, [debounced])

  const go = (path: string) => {
    setOpen(false)
    setQuery('')
    navigate(path)
  }

  const value = useMemo(() => ({ open: () => setOpen(true) }), [])
  const hasQuery = query.trim().length > 0

  return (
    <AskPaletteContext value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass p-0 sm:top-[16%] sm:max-w-xl sm:translate-y-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Search or ask</DialogTitle>
          <DialogDescription className="sr-only">Search for moments inside videos and for videos by title.</DialogDescription>
          {/* Filtering is ours (transcript matching), so cmdk's is off. */}
          <Command shouldFilter={false} className="bg-transparent">
            <CommandInput value={query} onValueChange={setQuery} placeholder="Search videos, or ask what was said…" />
            <CommandList>
              {!hasQuery ? (
                <CommandGroup heading="Try asking">
                  {TRY.map((q) => (
                    <CommandItem key={q} value={q} onSelect={() => setQuery(q)}>
                      <SparklesIcon className="text-brand" />
                      {q}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <>
                  <CommandEmpty>
                    <LogoMark className="mx-auto mb-3 h-8 opacity-60" />
                    No moments match that yet.
                  </CommandEmpty>
                  {results.moments.length > 0 && (
                    <CommandGroup heading="Moments">
                      {results.moments.map((m) => (
                        <CommandItem
                          key={`${m.video.id}-${m.start}`}
                          value={`${m.video.id}-${m.start}`}
                          onSelect={() => go(`/watch/${m.video.id}?t=${m.start}`)}
                          className="items-start"
                        >
                          <span className="mt-0.5 shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-xs text-link tabular-nums">
                            {formatDuration(m.start)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{m.video.title}</span>
                            <span className="line-clamp-2 text-muted-foreground">“{m.snippet}”</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {results.videos.length > 0 && (
                    <CommandGroup heading="Videos">
                      {results.videos.map((v) => (
                        <CommandItem key={v.id} value={`video-${v.id}`} onSelect={() => go(`/watch/${v.id}`)}>
                          <FilmIcon />
                          <span className="truncate">{v.title}</span>
                          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{formatDuration(v.durationSec)}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </>
              )}
            </CommandList>
          </Command>
          <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
            <span>Answers link to the exact moment</span>
            <span>
              <kbd className="rounded border px-1">↵</kbd> open · <kbd className="rounded border px-1">esc</kbd> close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </AskPaletteContext>
  )
}
