import type { ChannelDTO, VideoSummaryDTO } from '@reelstack/shared'
import { TvIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import EmptyState from '@/components/EmptyState'
import VideoGrid from '@/components/media/VideoGrid'
import { posterBackground } from '@/components/media/poster-palette'
import { Button } from '@/components/ui/button'
import { getSubscriptionFeed, listChannels } from '@/data'
import { useLibrary } from '@/hooks/use-library'

function ChannelChip({ channel, subscribed, onToggle }: { channel: ChannelDTO; subscribed?: boolean; onToggle?: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-3 rounded-full border border-border py-1.5 pr-2 pl-1.5">
      <Link to={`/channel/${channel.id}`} className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: posterBackground(channel.id) }}>
          {channel.name[0]}
        </span>
        <span className="text-sm font-medium whitespace-nowrap">{channel.name}</span>
      </Link>
      {onToggle && (
        <Button size="sm" variant={subscribed ? 'secondary' : 'default'} className="h-7 rounded-full" onClick={onToggle}>
          {subscribed ? 'Subscribed' : 'Subscribe'}
        </Button>
      )}
    </div>
  )
}

export default function Subscriptions() {
  const lib = useLibrary()
  const [channels, setChannels] = useState<ChannelDTO[]>([])
  const [feed, setFeed] = useState<VideoSummaryDTO[] | null>(null)
  const subsKey = lib.state.subscriptions.join(',')

  useEffect(() => {
    void listChannels().then(setChannels)
  }, [])

  useEffect(() => {
    let cancelled = false
    void getSubscriptionFeed(subsKey ? subsKey.split(',') : []).then((v) => !cancelled && setFeed(v))
    return () => {
      cancelled = true
    }
  }, [subsKey])

  const subscribed = channels.filter((c) => lib.state.subscriptions.includes(c.id))
  const others = channels.filter((c) => !lib.state.subscriptions.includes(c.id))

  return (
    <div className="space-y-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Subscriptions</h1>
      {subscribed.length > 0 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {subscribed.map((c) => (
            <ChannelChip key={c.id} channel={c} />
          ))}
        </div>
      )}

      {subscribed.length === 0 ? (
        <EmptyState icon={TvIcon} title="No subscriptions yet">
          Subscribe to channels and their newest videos land here.
        </EmptyState>
      ) : (
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold">Latest</h2>
          <VideoGrid videos={feed} />
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold">Channels you might like</h2>
          <div className="flex flex-wrap gap-2">
            {others.map((c) => (
              <ChannelChip key={c.id} channel={c} subscribed={false} onToggle={() => lib.toggle('subscriptions', c.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
