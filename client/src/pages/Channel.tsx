import type { ChannelDTO, VideoSummaryDTO } from '@reelstack/shared'
import { BellIcon, CheckIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import Poster from '@/components/media/Poster'
import VideoGrid from '@/components/media/VideoGrid'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getChannel } from '@/data'
import { useLibrary } from '@/hooks/use-library'
import { formatViews } from '@/lib/format'
import NotFound from './NotFound'

export default function Channel() {
  const { id = '' } = useParams()
  const lib = useLibrary()
  const [data, setData] = useState<{ channel: ChannelDTO; videos: VideoSummaryDTO[] } | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void getChannel(id).then((d) => !cancelled && setData(d))
    return () => {
      cancelled = true
    }
  }, [id])

  if (data === null) return <NotFound />
  const total = data?.videos.reduce((sum, v) => sum + v.views, 0) ?? 0
  const subscribed = lib.has('subscriptions', id)

  return (
    <div className="space-y-10">
      <div>
        {data ? <Poster seed={id} title="" showTitle={false} className="aspect-[3/1] rounded-3xl sm:aspect-[5/1]" /> : <Skeleton className="aspect-[3/1] rounded-3xl sm:aspect-[5/1]" />}
        <div className="-mt-10 flex flex-wrap items-end gap-4 px-4 sm:-mt-12 sm:px-8">
          <Avatar className="size-20 ring-4 ring-background sm:size-24">
            <AvatarFallback className="bg-primary font-display text-3xl font-bold text-primary-foreground">{data?.channel.name[0]}</AvatarFallback>
          </Avatar>
          <div className="pb-1">
            {data ? <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{data.channel.name}</h1> : <Skeleton className="h-8 w-48" />}
            {data && (
              <p className="text-sm text-muted-foreground">
                {data.channel.handle} · {data.videos.length} videos · {formatViews(total)}
              </p>
            )}
          </div>
          <Button className="mb-1 rounded-full sm:ml-auto" variant={subscribed ? 'secondary' : 'default'} onClick={() => lib.toggle('subscriptions', id)}>
            {subscribed ? <CheckIcon /> : <BellIcon />}
            {subscribed ? 'Subscribed' : 'Subscribe'}
          </Button>
        </div>
      </div>
      <VideoGrid videos={data?.videos ?? null} skeletons={4} />
    </div>
  )
}
