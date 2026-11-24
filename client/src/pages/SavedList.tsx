import { ClockIcon, HeartIcon, PlayIcon } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { Link } from 'react-router-dom'

import EmptyState from '@/components/EmptyState'
import VideoListItem, { VideoListItemSkeleton } from '@/components/media/VideoListItem'
import { posterBackground } from '@/components/media/poster-palette'
import { Button } from '@/components/ui/button'
import { useLibrary } from '@/hooks/use-library'
import { useVideos } from '@/hooks/use-videos'
import { formatDuration } from '@/lib/format'

const LISTS = {
  watchLater: { title: 'Watch later', icon: ClockIcon, empty: 'Tap the clock on any video to save it here.', remove: 'Remove from Watch later' },
  liked: { title: 'Liked videos', icon: HeartIcon, empty: 'Videos you like will collect here.', remove: 'Remove from Liked videos' },
} as const

/** Watch later and Liked videos: a playlist-style page. */
export default function SavedList({ list }: { list: keyof typeof LISTS }) {
  const lib = useLibrary()
  const meta = LISTS[list]
  const ids = lib.state[list]
  const videos = useVideos(ids)
  const total = videos?.reduce((sum, v) => sum + v.durationSec, 0) ?? 0
  const first = videos?.[0]

  return (
    <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="relative overflow-hidden rounded-3xl p-6 text-white lg:sticky lg:top-24 lg:self-start" style={{ background: posterBackground(first?.id ?? list) }}>
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative">
          <meta.icon className="size-8" />
          <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">{meta.title}</h1>
          <p className="mt-1 text-sm text-white/80">
            {ids.length} {ids.length === 1 ? 'video' : 'videos'}
            {total > 0 && ` · ${formatDuration(total)}`}
          </p>
          {first && (
            <Button asChild className="mt-6 rounded-full bg-white text-black hover:bg-white/90">
              <Link to={`/watch/${first.id}`}>
                <PlayIcon className="fill-current" /> Play all
              </Link>
            </Button>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        {videos === null ? (
          <ul>{Array.from({ length: 3 }, (_, i) => <VideoListItemSkeleton key={i} />)}</ul>
        ) : videos.length === 0 ? (
          <EmptyState icon={meta.icon} title="Nothing saved yet">
            {meta.empty}
          </EmptyState>
        ) : (
          <ul className="space-y-1">
            <AnimatePresence initial={false}>
              {videos.map((v) => (
                <VideoListItem key={v.id} video={v} onRemove={() => lib.toggle(list, v.id)} removeLabel={meta.remove} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  )
}
