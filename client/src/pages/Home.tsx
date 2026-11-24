import type { MomentDTO, VideoDetailDTO, VideoSummaryDTO } from '@reelstack/shared'
import { motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import MomentQuote from '@/components/media/MomentQuote'
import Shelf, { ShelfItem } from '@/components/media/Shelf'
import Stage from '@/components/media/Stage'
import VideoCard from '@/components/media/VideoCard'
import { CATEGORIES, type Shelf as ShelfData, getFeatured, getSubscriptionFeed, listHeardThisWeek, listShelves } from '@/data'
import { useLibrary } from '@/hooks/use-library'
import { useVideos } from '@/hooks/use-videos'
import { cn } from '@/lib/utils'

/** Big outlined rank number beside a card, for the Top 10 shelf. */
function Ranked({ rank, video }: { rank: number; video: VideoSummaryDTO }) {
  return (
    <li className="flex w-[86vw] shrink-0 snap-start items-start gap-1 sm:w-[400px]">
      <span
        aria-hidden
        className="-mt-2 w-16 shrink-0 text-center font-display text-[100px] leading-none font-black text-transparent select-none sm:w-20 sm:text-[128px]"
        style={{ WebkitTextStroke: '2px color-mix(in oklab, var(--foreground) 30%, transparent)' }}
      >
        {rank}
      </span>
      <span className="sr-only">Number {rank}:</span>
      <VideoCard video={video} tilt={false} className="min-w-0 flex-1" />
    </li>
  )
}

export default function Home() {
  const lib = useLibrary()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const [featured, setFeatured] = useState<VideoDetailDTO[] | null>(null)
  const [shelves, setShelves] = useState<ShelfData[] | null>(null)
  const [heard, setHeard] = useState<MomentDTO[]>([])
  const [subsFeed, setSubsFeed] = useState<VideoSummaryDTO[]>([])

  const history = lib.state.history.slice(0, 10)
  const continueVideos = useVideos(history.map((h) => h.id))
  const progressOf = useMemo(() => new Map(history.map((h) => [h.id, h.progress])), [history])
  const subsKey = lib.state.subscriptions.join(',')

  useEffect(() => {
    void getFeatured().then(setFeatured)
  }, [])

  useEffect(() => {
    let cancelled = false
    void Promise.all([listShelves(category || undefined), listHeardThisWeek(category || undefined)]).then(([s, h]) => {
      if (cancelled) return
      setShelves(s)
      setHeard(h)
    })
    return () => {
      cancelled = true
    }
  }, [category])

  useEffect(() => {
    let cancelled = false
    void getSubscriptionFeed(subsKey ? subsKey.split(',') : []).then((v) => !cancelled && setSubsFeed(v.slice(0, 10)))
    return () => {
      cancelled = true
    }
  }, [subsKey])

  const top10 = shelves?.find((s) => s.kind === 'top10')
  const rest = shelves?.filter((s) => s.kind !== 'top10') ?? []

  return (
    <div className="space-y-12">
      <Stage videos={featured} />

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:-mx-5 sm:px-5" role="tablist" aria-label="Filter by topic">
        {['', ...CATEGORIES].map((c) => {
          const active = c === category
          return (
            <button
              key={c || 'all'}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setParams(c ? { category: c } : {}, { replace: true })}
              className={cn('relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors', active ? 'text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
            >
              {active && <motion.span layoutId="home-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative">{c || 'All'}</span>
            </button>
          )
        })}
      </div>

      {lib.signedIn && continueVideos && continueVideos.length > 0 && !category && (
        <Shelf title="Continue watching" href="/history">
          {continueVideos.map((v) => (
            <ShelfItem key={v.id}>
              <VideoCard video={v} progress={progressOf.get(v.id)} />
            </ShelfItem>
          ))}
        </Shelf>
      )}

      {top10 && (
        <Shelf title={top10.title} subtitle="Most watched across ReelStack">
          {top10.items.map((v, i) => (
            <Ranked key={v.id} rank={i + 1} video={v} />
          ))}
        </Shelf>
      )}

      {heard.length > 0 && (
        <Shelf title="Heard this week" subtitle="Lines worth hearing. Tap one to jump straight to it.">
          {heard.map((m, i) => (
            <MomentQuote key={m.video.id} moment={m} index={i} className="w-[80vw] shrink-0 snap-start sm:w-[360px]" />
          ))}
        </Shelf>
      )}

      {lib.signedIn && subsFeed.length > 0 && !category && (
        <Shelf title="From your subscriptions" href="/subscriptions">
          {subsFeed.map((v) => (
            <ShelfItem key={v.id}>
              <VideoCard video={v} />
            </ShelfItem>
          ))}
        </Shelf>
      )}

      {shelves === null ? (
        <Shelf title="Loading…" loading />
      ) : (
        rest.map((s) => (
          <Shelf key={s.id} title={s.title}>
            {s.items.map((v) => (
              <ShelfItem key={v.id}>
                <VideoCard video={v} />
              </ShelfItem>
            ))}
          </Shelf>
        ))
      )}
    </div>
  )
}
