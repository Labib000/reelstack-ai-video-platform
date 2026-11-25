import { AUDIT_ACTIONS, type AuditAction, type AuditEntryDTO } from '@reelstack/shared'
import { BanIcon, EyeOffIcon, FileClockIcon, LogOutIcon, RotateCcwIcon, ShieldIcon, UndoIcon, VideoIcon } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { listAudit } from '@/api/admin'
import { PageHeader, Pagination, UserAvatar } from '@/components/admin/parts'
import EmptyState from '@/components/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useRequest } from '@/hooks/use-request'
import { AUDIT_LABELS, describeAudit } from '@/lib/audit'
import { timeAgo } from '@/lib/userAgent'
import { cn } from '@/lib/utils'

const ICONS: Record<AuditAction, { icon: typeof BanIcon; tone: string }> = {
  'user.role_changed': { icon: ShieldIcon, tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  'user.banned': { icon: BanIcon, tone: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  'user.unbanned': { icon: UndoIcon, tone: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'user.sessions_revoked': { icon: LogOutIcon, tone: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  'video.removed': { icon: EyeOffIcon, tone: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  'video.restored': { icon: VideoIcon, tone: 'bg-green-500/15 text-green-700 dark:text-green-400' },
  'video.reprocessed': { icon: RotateCcwIcon, tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
}

const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

function dayHeading(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return dayFmt.format(d)
}

const PAGE_SIZE = 25

export default function Audit() {
  const [params, setParams] = useSearchParams()
  const action = (AUDIT_ACTIONS as readonly string[]).includes(params.get('action') ?? '') ? (params.get('action') as AuditAction) : undefined
  const page = Math.max(1, Number(params.get('page')) || 1)
  const { data, error, loading } = useRequest(`audit-${action}-${page}`, (signal) => listAudit({ action, page, pageSize: PAGE_SIZE }, signal))

  const set = (next: { action?: string; page?: number }) => {
    const p = new URLSearchParams()
    const a = 'action' in next ? next.action : action
    if (a) p.set('action', a)
    if (next.page && next.page > 1) p.set('page', String(next.page))
    setParams(p, { replace: true })
  }

  const groups: { day: string; items: AuditEntryDTO[] }[] = []
  for (const e of data?.items ?? []) {
    const day = dayHeading(e.createdAt)
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] })
    groups.at(-1)!.items.push(e)
  }

  return (
    <>
      <PageHeader title="Audit log" description="Every role change, suspension, sign-out and video takedown, and who did it." />

      <div role="group" aria-label="Filter by action" className="mb-5 flex flex-wrap gap-1.5">
        {([undefined, ...AUDIT_ACTIONS] as const).map((a) => (
          <button
            key={a ?? 'all'}
            type="button"
            aria-pressed={action === a}
            onClick={() => set({ action: a, page: 1 })}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              action === a ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {a ? AUDIT_LABELS[a] : 'Everything'}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!data ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={FileClockIcon} title="Nothing here yet">
          Admin actions will show up here as they happen.
        </EmptyState>
      ) : (
        <div className={cn('space-y-6 transition-opacity', loading && 'opacity-60')}>
          {groups.map((g) => (
            <section key={g.day}>
              <h2 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{g.day}</h2>
              <ol className="glass divide-y divide-glass-border overflow-hidden rounded-2xl">
                {g.items.map((e) => {
                  const { icon: Icon, tone } = ICONS[e.action]
                  return (
                    <li key={e.id} className="flex items-start gap-3 p-4">
                      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', tone)}>
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">{describeAudit(e)}</p>
                        {e.meta.reason && <p className="mt-0.5 text-sm text-muted-foreground">“{e.meta.reason}”</p>}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {timeFmt.format(new Date(e.createdAt))} · {timeAgo(e.createdAt)}
                        </p>
                      </div>
                      {e.target && (
                        <Link to={`/admin/users/${e.target.id}`} className="hidden shrink-0 items-center gap-2 rounded-xl px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground sm:flex">
                          <UserAvatar user={{ name: e.target.name, avatarUrl: null }} className="size-6" />
                          View
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            </section>
          ))}
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p })} />
        </div>
      )}
    </>
  )
}
