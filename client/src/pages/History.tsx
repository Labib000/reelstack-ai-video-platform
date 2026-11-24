import { HistoryIcon, PauseIcon, PlayIcon, SearchIcon, Trash2Icon } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useMemo, useState } from 'react'

import EmptyState from '@/components/EmptyState'
import VideoListItem, { VideoListItemSkeleton } from '@/components/media/VideoListItem'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useLibrary } from '@/hooks/use-library'
import { useVideos } from '@/hooks/use-videos'

function dayLabel(iso: string, now = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((day(now) - day(new Date(iso))) / 86_400_000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return 'This week'
  return 'Earlier'
}

export default function History() {
  const lib = useLibrary()
  const { history, historyPaused } = lib.state
  const videos = useVideos(history.map((h) => h.id))
  const [filter, setFilter] = useState('')

  const groups = useMemo(() => {
    const byId = new Map(videos?.map((v) => [v.id, v]))
    const f = filter.trim().toLowerCase()
    const out = new Map<string, { entry: (typeof history)[number]; video: NonNullable<ReturnType<typeof byId.get>> }[]>()
    for (const entry of history) {
      const video = byId.get(entry.id)
      if (!video || (f && !`${video.title} ${video.channel.name}`.toLowerCase().includes(f))) continue
      const label = dayLabel(entry.watchedAt)
      out.set(label, [...(out.get(label) ?? []), { entry, video }])
    }
    return [...out]
  }, [history, videos, filter])

  return (
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <h1 className="mb-6 font-display text-4xl font-bold tracking-tight">Watch history</h1>
        {historyPaused && <p className="mb-6 rounded-xl bg-muted px-4 py-3 text-sm">History is paused. Videos you watch now won't be added.</p>}
        {videos === null ? (
          <ul>{Array.from({ length: 4 }, (_, i) => <VideoListItemSkeleton key={i} />)}</ul>
        ) : history.length === 0 ? (
          <EmptyState icon={HistoryIcon} title="Nothing here yet">
            Videos you watch will show up here, so you can pick up where you left off.
          </EmptyState>
        ) : groups.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground">No videos in your history match “{filter}”.</p>
        ) : (
          <div className="space-y-8">
            {groups.map(([label, items]) => (
              <section key={label}>
                <h2 className="mb-2 font-display text-lg font-semibold">{label}</h2>
                <ul className="space-y-1">
                  <AnimatePresence initial={false}>
                    {items.map(({ entry, video }) => (
                      <VideoListItem key={video.id} video={video} progress={entry.progress} onRemove={() => lib.removeFromHistory(video.id)} removeLabel="Remove from history" />
                    ))}
                  </AnimatePresence>
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <aside className="order-first space-y-3 lg:order-none lg:sticky lg:top-24 lg:self-start">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search watch history" aria-label="Search watch history" className="pl-9" />
        </div>
        <div className="flex gap-2 lg:flex-col">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="justify-start" disabled={history.length === 0}>
                <Trash2Icon /> Clear all history
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear watch history?</AlertDialogTitle>
                <AlertDialogDescription>This removes every video from your history and your Continue watching row. It can't be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => lib.clearHistory()}>Clear history</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" className="justify-start" onClick={() => lib.setHistoryPaused(!historyPaused)}>
            {historyPaused ? <PlayIcon /> : <PauseIcon />}
            {historyPaused ? 'Turn history back on' : 'Pause history'}
          </Button>
        </div>
      </aside>
    </div>
  )
}
