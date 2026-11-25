import { ADMIN_VIDEO_STATUSES, type AdminVideoDTO, can } from '@reelstack/shared'
import { EyeOffIcon, MoreHorizontalIcon, PlayIcon, RotateCcwIcon, SearchIcon, TriangleAlertIcon, UndoIcon, UserIcon, VideoOffIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { apiError } from '@/api/http'
import { listAdminVideos, removeVideo, reprocessVideo, restoreVideo } from '@/api/videos'
import { useAuth } from '@/auth/context'
import { PageHeader, Pagination } from '@/components/admin/parts'
import EmptyState from '@/components/EmptyState'
import Poster from '@/components/media/Poster'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import StageBadge from '@/components/videos/StageBadge'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useRequest } from '@/hooks/use-request'
import { formatBytes, formatDuration } from '@/lib/format'
import { timeAgo } from '@/lib/userAgent'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20
type Filter = '' | (typeof ADMIN_VIDEO_STATUSES)[number]
const FILTERS: { value: Filter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'uploading', label: 'Uploading' },
  { value: 'processing', label: 'Processing' },
  { value: 'ready', label: 'Ready' },
  { value: 'failed', label: 'Failed' },
  { value: 'removed', label: 'Removed' },
]

type Pending = { kind: 'remove' | 'restore' | 'reprocess'; video: AdminVideoDTO } | null

export default function Videos() {
  const { user: me } = useAuth()
  const canModerate = can(me?.role, 'video:moderate')
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), 300)
  const status = ((ADMIN_VIDEO_STATUSES as readonly string[]).includes(params.get('status') ?? '') ? params.get('status') : '') as Filter
  const page = Math.max(1, Number(params.get('page')) || 1)

  const setFilter = (next: { status?: Filter; page?: number }) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        const s = next.status ?? status
        if (s) p.set('status', s)
        else p.delete('status')
        const pg = next.page ?? (next.status !== undefined ? 1 : page)
        if (pg > 1) p.set('page', String(pg))
        else p.delete('page')
        return p
      },
      { replace: true },
    )

  const query = { q: q || undefined, status: status || undefined, page, pageSize: PAGE_SIZE }
  const { data, error, loading, setData } = useRequest(JSON.stringify(query), (signal) => listAdminVideos(query, signal))
  const replace = (v: AdminVideoDTO) => setData((d) => d && { ...d, items: d.items.map((x) => (x.id === v.id ? v : x)) })

  const [pending, setPending] = useState<Pending>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!pending) return
    setBusy(true)
    try {
      const { kind, video } = pending
      if (kind === 'remove') replace(await removeVideo(video.id, reason.trim()))
      else if (kind === 'restore') replace(await restoreVideo(video.id))
      else replace(await reprocessVideo(video.id))
      toast.success({ remove: 'Video removed', restore: 'Video restored', reprocess: 'Queued for processing again' }[kind])
      setPending(null)
      setReason('')
    } catch (e) {
      const info = apiError(e)
      toast.error(info.fieldErrors.reason ?? info.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = {
    remove: {
      title: `Remove “${pending?.video.title}”?`,
      body: 'Nobody but the owner will be able to see it. They’ll see your reason. You can restore it later.',
      action: 'Remove video',
    },
    restore: { title: `Restore “${pending?.video.title}”?`, body: 'It goes back to the owner’s chosen visibility.', action: 'Restore' },
    reprocess: { title: 'Process this video again?', body: 'Runs the file check and the transcode again. Useful when it failed for a temporary reason, like storage being briefly unreachable.', action: 'Reprocess' },
  }[pending?.kind ?? 'restore']

  return (
    <>
      <PageHeader title="Videos" description="Every upload, where it is in processing, and moderation." />

      <div className="glass mb-4 flex flex-col gap-3 rounded-2xl p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (page > 1) setFilter({ page: 1 })
            }}
            placeholder="Search titles"
            className="h-10 rounded-xl pl-9"
            aria-label="Search videos"
          />
        </div>
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={status === f.value}
              onClick={() => setFilter({ status: f.value })}
              className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', status === f.value ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={VideoOffIcon} title={q || status ? 'No videos match' : 'No uploads yet'}>
          {q || status ? 'Try a different search or filter.' : 'Videos people upload show up here, with their processing state.'}
        </EmptyState>
      ) : data ? (
        <div className={cn('space-y-4 transition-opacity', loading && 'opacity-60')}>
          <ul className="glass divide-y divide-glass-border overflow-hidden rounded-2xl">
            {data.items.map((v) => (
              <li key={v.id} className={cn('flex items-center gap-3 p-3 sm:gap-4', v.removedAt && 'bg-muted/30')}>
                <div className={cn('relative w-24 shrink-0 sm:w-32', v.removedAt && 'opacity-50 grayscale')}>
                  <Poster seed={v.id} title={v.title} thumbnailUrl={v.thumbnailUrl} showTitle={false} className="aspect-video rounded-lg" />
                  {v.durationSec != null && (
                    <span className="absolute right-1 bottom-1 rounded bg-black/75 px-1 font-mono text-[10px] text-white">{formatDuration(v.durationSec)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{v.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.owner ? (
                      <Link to={`/admin/users/${v.owner.id}`} className="hover:text-foreground hover:underline">
                        {v.owner.username ? `@${v.owner.username}` : v.owner.name}
                      </Link>
                    ) : (
                      'Deleted account'
                    )}
                    {' · '}
                    {formatBytes(v.sizeBytes)}
                    {v.height != null && ` · ${v.width}×${v.height}`} · <span className="capitalize">{v.visibility}</span> · {timeAgo(v.createdAt)}
                  </p>
                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                    <StageBadge video={v} />
                    {(v.error || v.removedReason) && (
                      <span className="flex min-w-0 items-center gap-1 truncate text-[11px] text-red-600 dark:text-red-400">
                        <TriangleAlertIcon className="size-3 shrink-0" />
                        <span className="truncate">{v.removedReason ?? v.error}</span>
                      </span>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${v.title}`}>
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {v.status === 'ready' && canModerate && (
                      <DropdownMenuItem asChild>
                        <Link to={`/watch/${v.id}`}>
                          <PlayIcon /> Watch
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {v.owner && (
                      <DropdownMenuItem asChild>
                        <Link to={`/admin/users/${v.owner.id}`}>
                          <UserIcon /> View owner
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {canModerate && (
                      <>
                        {v.status === 'failed' && (
                          <DropdownMenuItem onSelect={() => setPending({ kind: 'reprocess', video: v })}>
                            <RotateCcwIcon /> Reprocess
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {v.removedAt ? (
                          <DropdownMenuItem onSelect={() => setPending({ kind: 'restore', video: v })}>
                            <UndoIcon /> Restore
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem variant="destructive" onSelect={() => setPending({ kind: 'remove', video: v })}>
                            <EyeOffIcon /> Remove
                          </DropdownMenuItem>
                        )}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => setFilter({ page: p })} />
        </div>
      ) : null}

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.body}</AlertDialogDescription>
          </AlertDialogHeader>
          {pending?.kind === 'remove' && (
            <div className="space-y-2">
              <Label htmlFor="remove-reason">Reason (shown to the owner and in the audit log)</Label>
              <Textarea id="remove-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Contains copyrighted footage" maxLength={200} rows={3} autoFocus />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void confirm()
              }}
              disabled={busy || (pending?.kind === 'remove' && reason.trim().length < 3)}
              className={pending?.kind === 'remove' ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
            >
              {busy && <Spinner />}
              {copy.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
