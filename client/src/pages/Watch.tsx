import type { TranscriptSegment, VideoDetailDTO, VideoSummaryDTO } from '@reelstack/shared'
import { BellIcon, CheckIcon, ClockIcon, HeartIcon, Share2Icon, SparklesIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import Shelf, { ShelfItem } from '@/components/media/Shelf'
import VideoCard from '@/components/media/VideoCard'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import Console, { type ConsoleTab } from '@/components/watch/Console'
import PlayerStage from '@/components/watch/PlayerStage'
import { getSuggestions, getTranscript, getUpNext, getVideo } from '@/data'
import { useLibrary } from '@/hooks/use-library'
import { formatDuration, formatViews } from '@/lib/format'
import { timeAgo } from '@/lib/userAgent'
import { cn } from '@/lib/utils'
import NotFound from './NotFound'

const HISTORY_EVERY_SEC = 5

export default function Watch() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const lib = useLibrary()
  const [video, setVideo] = useState<VideoDetailDTO | null | undefined>(undefined)
  const [transcript, setTranscript] = useState<TranscriptSegment[] | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [upNext, setUpNext] = useState<VideoSummaryDTO[] | null>(null)
  const [time, setTime] = useState(() => Number(params.get('t')) || 0)
  const [playing, setPlaying] = useState(false)
  const [tab, setTab] = useState<ConsoleTab>(params.get('panel') === 'ask' ? 'ask' : params.get('t') ? 'transcript' : 'chapters')
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getVideo(id).then((v) => !cancelled && setVideo(v))
    void getTranscript(id).then((t) => !cancelled && setTranscript(t))
    void getSuggestions(id).then((s) => !cancelled && setSuggestions(s))
    void getUpNext(id).then((u) => !cancelled && setUpNext(u))
    return () => {
      cancelled = true
    }
  }, [id])

  // Stand-in playback until the real player arrives: advance the clock.
  useEffect(() => {
    if (!playing || !video) return
    const timer = setInterval(() => setTime((t) => Math.min(video.durationSec, t + 1)), 1000)
    return () => clearInterval(timer)
  }, [playing, video])

  // History: record once playback starts, then every few seconds.
  const { recordView } = lib
  const lastRecorded = useRef(-Infinity)
  useEffect(() => {
    if (!playing || !video || Math.abs(time - lastRecorded.current) < HISTORY_EVERY_SEC) return
    lastRecorded.current = time
    recordView(video.id, time / video.durationSec)
  }, [playing, time, video, recordView])

  const seek = useCallback((seconds: number) => {
    setTime(seconds)
    setPlaying(true)
  }, [])

  if (video === null) return <NotFound />

  const liked = video ? lib.has('liked', video.id) : false
  const saved = video ? lib.has('watchLater', video.id) : false
  const subscribed = video ? lib.has('subscriptions', video.channel.id) : false

  const toggle = (list: 'liked' | 'watchLater' | 'subscriptions', target: string, on: string, off: string) => {
    const now = lib.toggle(list, target)
    if (now !== null) toast.success(now ? on : off)
  }

  return (
    <div className="space-y-12">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-5">
          {video ? <PlayerStage video={video} time={time} playing={playing} onTogglePlay={() => setPlaying((p) => !p)} onSeek={seek} /> : <Skeleton className="aspect-video rounded-2xl" />}

          {video ? (
            <div className="space-y-4">
              <h1 className="font-display text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl">{video.title}</h1>
              <div className="flex flex-wrap items-center gap-3">
                <Link to={`/channel/${video.channel.id}`} className="flex items-center gap-3 rounded-full pr-2 hover:bg-accent">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-primary/15 font-semibold text-link">{video.channel.name[0]}</AvatarFallback>
                  </Avatar>
                  <span>
                    <span className="block text-sm font-semibold">{video.channel.name}</span>
                    <span className="block text-xs text-muted-foreground">{video.channel.handle}</span>
                  </span>
                </Link>
                <Button
                  size="sm"
                  variant={subscribed ? 'secondary' : 'default'}
                  className="rounded-full"
                  onClick={() => toggle('subscriptions', video.channel.id, `Subscribed to ${video.channel.name}`, 'Unsubscribed')}
                >
                  {subscribed ? <CheckIcon /> : <BellIcon />}
                  {subscribed ? 'Subscribed' : 'Subscribe'}
                </Button>
                <div className="flex w-full gap-2 overflow-x-auto sm:ml-auto sm:w-auto">
                  <Button variant="secondary" className={cn('rounded-full', liked && 'text-link')} aria-pressed={liked} onClick={() => toggle('liked', video.id, 'Added to Liked videos', 'Removed from Liked videos')}>
                    <HeartIcon className={liked ? 'fill-current' : ''} />
                    {formatViews(video.likes + (liked ? 1 : 0)).replace(' views', '')}
                  </Button>
                  <Button variant="secondary" className="rounded-full" aria-pressed={saved} onClick={() => toggle('watchLater', video.id, 'Saved to Watch later', 'Removed from Watch later')}>
                    {saved ? <CheckIcon /> : <ClockIcon />}
                    {saved ? 'Saved' : 'Save'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="rounded-full"
                    onClick={() => {
                      void navigator.clipboard?.writeText(`${window.location.origin}/watch/${video.id}?t=${time}`)
                      toast.success(`Link copied at ${formatDuration(time)}`)
                    }}
                  >
                    <Share2Icon /> Share moment
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl bg-muted/60 p-4 text-sm">
                <p className="font-medium">
                  {formatViews(video.views)} · {timeAgo(video.createdAt)} · {video.chapters.length} chapters
                </p>
                {video.summary && (
                  <p className="mt-2 flex gap-2">
                    <SparklesIcon className="mt-0.5 size-4 shrink-0 text-brand" aria-label="AI summary" />
                    {video.summary}
                  </p>
                )}
                <p className={cn('mt-2 text-muted-foreground', !showMore && 'line-clamp-1')}>{video.description}</p>
                <button type="button" onClick={() => setShowMore((s) => !s)} className="mt-1 text-xs font-medium text-link hover:underline">
                  {showMore ? 'Show less' : 'Show more'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-10 w-1/3" />
            </div>
          )}
        </div>

        <aside className="h-[480px] lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          {video ? <Console video={video} transcript={transcript} suggestions={suggestions} time={time} tab={tab} onTabChange={setTab} onSeek={seek} /> : <Skeleton className="h-full rounded-2xl" />}
        </aside>
      </div>

      <Shelf title="Up next" loading={upNext === null}>
        {upNext?.map((v) => (
          <ShelfItem key={v.id}>
            <VideoCard video={v} />
          </ShelfItem>
        ))}
      </Shelf>
    </div>
  )
}
