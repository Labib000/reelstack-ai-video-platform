import type { MomentDTO, VideoSummaryDTO } from '@reelstack/shared'
import { SearchIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import MomentQuote from '@/components/media/MomentQuote'
import VideoGrid from '@/components/media/VideoGrid'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CATEGORIES, listVideos, searchMoments, searchVideos } from '@/data'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { cn } from '@/lib/utils'

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const [draft, setDraft] = useState(q)
  const debounced = useDebouncedValue(draft.trim(), 300)
  const [videos, setVideos] = useState<VideoSummaryDTO[] | null>(null)
  const [moments, setMoments] = useState<MomentDTO[] | null>(null)

  useEffect(() => {
    if (debounced === q) return
    const next = new URLSearchParams(params)
    if (debounced) next.set('q', debounced)
    else next.delete('q')
    setParams(next, { replace: true })
  }, [debounced, q, params, setParams])

  useEffect(() => {
    let cancelled = false
    if (q) {
      void Promise.all([searchVideos(q), searchMoments(q, 12)]).then(([v, m]) => {
        if (cancelled) return
        setVideos(v)
        setMoments(m)
      })
    } else {
      void listVideos(category || undefined).then((v) => !cancelled && setVideos(v))
    }
    return () => {
      cancelled = true
    }
  }, [q, category])

  const setCategory = (c: string) => {
    const next = new URLSearchParams(params)
    if (c) next.set('category', c)
    else next.delete('category')
    setParams(next)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Explore</h1>
          <p className="mt-1 text-muted-foreground">Search titles, or anything said inside a video.</p>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Search videos and moments" className="h-11 rounded-full pl-9" aria-label="Search" />
        </div>
      </div>

      {q ? (
        <Tabs defaultValue="videos">
          <TabsList>
            <TabsTrigger value="videos">Videos {videos && `(${videos.length})`}</TabsTrigger>
            <TabsTrigger value="moments">Moments {moments && `(${moments.length})`}</TabsTrigger>
          </TabsList>
          <TabsContent value="videos" className="mt-6">
            {videos?.length === 0 ? <p className="py-10 text-center text-muted-foreground">No titles match. Try the Moments tab.</p> : <VideoGrid videos={videos} />}
          </TabsContent>
          <TabsContent value="moments" className="mt-6">
            {moments?.length === 0 && <p className="py-10 text-center text-muted-foreground">Nobody says that in a video yet.</p>}
            <ol className="grid gap-4 md:grid-cols-2">
              {moments?.map((m, i) => <MomentQuote key={`${m.video.id}-${m.start}`} moment={m} index={i} />)}
            </ol>
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Categories">
            {['', ...CATEGORIES].map((c) => {
              const active = c === category
              return (
                <button
                  key={c || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategory(c)}
                  className={cn('relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors', active ? 'text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
                >
                  {active && <motion.span layoutId="explore-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                  <span className="relative">{c || 'All'}</span>
                </button>
              )
            })}
          </div>
          <VideoGrid videos={videos} />
        </>
      )}
    </div>
  )
}
