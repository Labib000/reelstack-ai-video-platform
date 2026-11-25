import { ClockIcon, HeartIcon, HistoryIcon } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/context'
import EmptyState from '@/components/EmptyState'
import MyVideos from '@/components/videos/MyVideos'
import Shelf, { ShelfItem } from '@/components/media/Shelf'
import VideoCard from '@/components/media/VideoCard'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useLibrary } from '@/hooks/use-library'
import { useVideos } from '@/hooks/use-videos'

/** "You": a summary of everything personal, each section linking to its full page. */
export default function Library() {
  const { user } = useAuth()
  const lib = useLibrary()
  const { hash } = useLocation()
  const history = lib.state.history.slice(0, 12)
  const historyVideos = useVideos(history.map((h) => h.id))
  const later = useVideos(lib.state.watchLater)
  const liked = useVideos(lib.state.liked)
  const progressOf = useMemo(() => new Map(history.map((h) => [h.id, h.progress])), [history])

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  const shelf = (title: string, href: string, icon: typeof HistoryIcon, videos: typeof later, empty: string, withProgress = false) => (
    <Shelf title={title} href={href} loading={videos === null}>
      {videos?.length === 0 ? (
        <li className="w-full">
          <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`}>
            {empty}
          </EmptyState>
        </li>
      ) : (
        videos?.map((v) => (
          <ShelfItem key={v.id}>
            <VideoCard video={v} progress={withProgress ? progressOf.get(v.id) : undefined} />
          </ShelfItem>
        ))
      )}
    </Shelf>
  )

  return (
    <div className="space-y-12">
      {user && (
        <header className="flex items-center gap-4">
          <Avatar className="size-16 sm:size-20">
            <AvatarFallback className="bg-primary font-display text-2xl font-bold text-primary-foreground">{user.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{user.name}</h1>
            <p className="text-sm text-muted-foreground">
              {user.username && <span className="font-medium text-foreground">@{user.username} · </span>}
              {lib.state.history.length} watched · {lib.state.watchLater.length} saved · {lib.state.liked.length} liked · {lib.state.subscriptions.length} subscriptions
            </p>
          </div>
        </header>
      )}

      {shelf('History', '/history', HistoryIcon, historyVideos, 'Videos you watch will show up here.', true)}
      {shelf('Watch later', '/watch-later', ClockIcon, later, 'Tap the clock on any video to save it here.')}
      {shelf('Liked videos', '/liked', HeartIcon, liked, 'Videos you like will collect here.')}

      <MyVideos />
    </div>
  )
}
