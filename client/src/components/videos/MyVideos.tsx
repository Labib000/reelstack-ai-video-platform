import type { OwnVideoDTO } from '@reelstack/shared'
import { ClapperboardIcon, MoreHorizontalIcon, PencilIcon, PlayIcon, PlusIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { apiError } from '@/api/http'
import { deleteVideo, myVideos } from '@/api/videos'
import Poster from '@/components/media/Poster'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useRequest } from '@/hooks/use-request'
import { formatBytes, formatDuration } from '@/lib/format'

import EditVideoDialog from './EditVideoDialog'
import StageBadge from './StageBadge'
import { isActive } from './stage'

/** "Your videos" on the Library page: real uploads, with edit and delete. */
export default function MyVideos() {
  const { data, error, loading, reload, setData } = useRequest('my-videos', myVideos)
  const [editing, setEditing] = useState<OwnVideoDTO | null>(null)
  const [deleting, setDeleting] = useState<OwnVideoDTO | null>(null)
  const [busy, setBusy] = useState(false)

  // Keep statuses fresh while anything is still being uploaded, checked or transcoded.
  const active = data?.some(isActive) ?? false
  useEffect(() => {
    if (!active) return
    const timer = setInterval(reload, 5000)
    return () => clearInterval(timer)
  }, [active, reload])

  const replace = (v: OwnVideoDTO) => setData((list) => list?.map((x) => (x.id === v.id ? v : x)))

  async function confirmDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteVideo(deleting.id)
      setData((list) => list?.filter((x) => x.id !== deleting.id))
      toast.success('Video deleted')
      setDeleting(null)
    } catch (e) {
      toast.error(apiError(e).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="your-videos" className="scroll-mt-24">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight sm:text-2xl">
          <ClapperboardIcon className="size-5 text-brand" /> Your videos
          {data && data.length > 0 && <span className="text-base font-normal text-muted-foreground">{data.length}</span>}
        </h2>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/upload">
            <PlusIcon /> Upload
          </Link>
        </Button>
      </div>

      {error && !data ? (
        <div className="glass flex items-center justify-between gap-4 rounded-2xl p-4 text-sm">
          <span className="text-destructive-foreground">{error}</span>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="glass divide-y divide-glass-border overflow-hidden rounded-2xl">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4 p-3">
              <Skeleton className="aspect-video w-28 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : !data?.length ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center">
          <ClapperboardIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">You haven’t uploaded anything yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">Talks, tutorials and lectures work best. People will be able to ask your video questions.</p>
          <Button asChild className="mt-2 rounded-full">
            <Link to="/upload">
              <PlusIcon /> Upload your first video
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="glass divide-y divide-glass-border overflow-hidden rounded-2xl">
          {data.map((v) => (
            <li key={v.id} className="flex items-center gap-3 p-3 sm:gap-4">
              <Poster seed={v.id} title={v.title} thumbnailUrl={v.thumbnailUrl} showTitle={false} className="aspect-video w-24 shrink-0 rounded-lg sm:w-28" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {v.status === 'ready' ? (
                    <Link to={`/watch/${v.id}`} className="hover:underline">
                      {v.title}
                    </Link>
                  ) : (
                    v.title
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  <span className="capitalize">{v.visibility}</span> · {formatBytes(v.sizeBytes)}
                  {v.durationSec != null && ` · ${formatDuration(v.durationSec)}`}
                  {v.width != null && v.height != null && ` · ${Math.min(v.width, v.height)}p`}
                </p>
                <StageBadge video={v} className="mt-1 sm:hidden" />
                {(v.status === 'failed' || v.removedAt) && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-destructive-foreground">
                    <TriangleAlertIcon className="size-3 shrink-0" />
                    {v.removedAt ? `Removed by a moderator: ${v.removedReason}` : v.error}
                  </p>
                )}
              </div>
              <StageBadge video={v} className="hidden shrink-0 sm:inline-flex" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Actions for ${v.title}`}>
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {v.status === 'ready' && (
                    <DropdownMenuItem asChild>
                      <Link to={`/watch/${v.id}`}>
                        <PlayIcon /> Watch
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onSelect={() => setEditing(v)}>
                    <PencilIcon /> Edit details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(v)}>
                    <Trash2Icon /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {editing && <EditVideoDialog key={editing.id} video={editing} open onOpenChange={(o) => !o && setEditing(null)} onSaved={replace} />}

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && !busy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.status === 'uploading' ? 'The upload is stopped and its parts are thrown away.' : 'The video file is removed from storage for good. This can’t be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirmDelete()
              }}
              disabled={busy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {busy && <Spinner />} Delete video
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
