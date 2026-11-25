import { EyeOffIcon, GlobeIcon, LinkIcon, LockIcon, Share2Icon } from 'lucide-react'
import { useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { watchVideo } from '@/api/videos'
import { useAuth } from '@/auth/context'
import { UserAvatar } from '@/components/admin/parts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import HlsPlayer from '@/components/watch/HlsPlayer'
import { useRequest } from '@/hooks/use-request'
import { formatDuration } from '@/lib/format'
import { timeAgo } from '@/lib/userAgent'

import NotFound from './NotFound'

const VISIBILITY = { public: GlobeIcon, unlisted: LinkIcon, private: LockIcon }

/**
 * The watch page for real uploads. Likes, saves, channels and the Ask console
 * still run on placeholder data, so they aren't offered here yet.
 */
export default function WatchUpload({ id }: { id: string }) {
  const { status, user } = useAuth()
  // Wait for the session check: a private video needs to know who's asking.
  if (status === 'loading') return <Loading />
  return <Loaded key={user?.id ?? 'anon'} id={id} />
}

function Loading() {
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Skeleton className="aspect-video rounded-2xl" />
      <Skeleton className="h-8 w-2/3" />
    </div>
  )
}

function Loaded({ id }: { id: string }) {
  const [params] = useSearchParams()
  const { data: video, error, loading, reload } = useRequest(`watch-${id}`, (signal) => watchVideo(id, signal))
  const time = useRef(0)

  if (!video) return loading ? <Loading /> : error === 'Video not found.' ? <NotFound /> : (
    <Alert variant="destructive">
      <AlertDescription className="flex items-center justify-between gap-3">
        {error}
        <Button size="sm" variant="outline" onClick={reload}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  )

  const Icon = VISIBILITY[video.visibility]
  const share = async () => {
    const t = Math.floor(time.current)
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/watch/${video.id}${t > 0 ? `?t=${t}` : ''}`)
      toast.success(t > 0 ? `Link copied at ${formatDuration(t)}` : 'Link copied')
    } catch {
      toast.error('Couldn’t copy the link')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {video.removedReason && (
        <Alert variant="destructive">
          <EyeOffIcon />
          <AlertDescription>Removed by a moderator: {video.removedReason}. Only the owner and moderators can see it.</AlertDescription>
        </Alert>
      )}
      <HlsPlayer video={video} startAt={Number(params.get('t')) || 0} onTime={(t) => (time.current = t)} onExpired={reload} renewError={error} />
      <h1 className="font-display text-2xl leading-tight font-bold tracking-tight text-balance break-words sm:text-3xl">{video.title}</h1>
      <div className="flex flex-wrap items-center gap-3">
        {video.owner && (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar user={{ name: video.owner.name, avatarUrl: null }} className="size-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{video.owner.name}</p>
              {video.owner.username && <p className="truncate text-xs text-muted-foreground">@{video.owner.username}</p>}
            </div>
          </div>
        )}
        <Button variant="secondary" className="ml-auto rounded-full" onClick={() => void share()}>
          <Share2Icon /> Share moment
        </Button>
      </div>
      <div className="rounded-2xl bg-muted/60 p-4 text-sm">
        <p className="flex flex-wrap items-center gap-x-2 font-medium">
          <Icon className="size-4" />
          <span className="capitalize">{video.visibility}</span> · {timeAgo(video.createdAt)} · {formatDuration(video.durationSec)}
        </p>
        {video.description && <p className="mt-2 break-words whitespace-pre-line text-muted-foreground">{video.description}</p>}
      </div>
    </div>
  )
}
