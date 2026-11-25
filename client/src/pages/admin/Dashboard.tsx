import { can } from '@reelstack/shared'
import { ActivityIcon, BanIcon, CpuIcon, FilmIcon, MessageSquareTextIcon, UserPlusIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { getStats } from '@/api/admin'
import { useAuth } from '@/auth/context'
import SignupChart from '@/components/admin/SignupChart'
import { PageHeader, Panel, RolePill, StatCard, StatusPill, UserAvatar } from '@/components/admin/parts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRequest } from '@/hooks/use-request'
import { formatBytes } from '@/lib/format'
import { timeAgo } from '@/lib/userAgent'

/** Read once per visit; it only picks the greeting. */
function greeting(hour: number) {
  return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'
}

const ROLE_COLORS = { admin: 'bg-primary', moderator: 'bg-amber-500', user: 'bg-foreground/40' } as const

export default function Dashboard() {
  const { user } = useAuth()
  const { data, error, loading, reload } = useRequest('admin-stats', getStats)
  const people = can(user?.role, 'user:view')
  const [hour] = useState(() => new Date().getHours())

  if (error && !data)
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-3">
          {error}
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )

  return (
    <>
      <PageHeader
        title={`Good ${greeting(hour)}, ${user?.name.split(' ')[0] ?? ''}`}
        description="What’s happening on ReelStack right now."
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <ActivityIcon /> Refresh
          </Button>
        }
      />

      {!data ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
          <Skeleton className="col-span-2 h-72 rounded-2xl xl:col-span-3" />
          <Skeleton className="col-span-2 h-72 rounded-2xl xl:col-span-1" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard icon={UsersIcon} label="Total users" value={data.users.total} hint={`${data.users.byRole.admin + data.users.byRole.moderator} staff`} />
          <StatCard icon={UserPlusIcon} label="New this week" value={data.users.new7d} delta={data.users.new7d - data.users.prev7d} hint="vs last week" />
          <StatCard icon={ActivityIcon} label="Active sessions" value={data.activeSessions} hint="signed-in devices" />
          <StatCard icon={BanIcon} label="Suspended" value={data.users.banned} hint={`${data.users.new30d} joined in 30 days`} />

          <Panel title="Signups" className="col-span-2 xl:col-span-3">
            <SignupChart data={data.signupsByDay} />
          </Panel>

          <Panel title="Roles" className="col-span-2 xl:col-span-1">
            <div className="flex h-3 overflow-hidden rounded-full bg-muted">
              {(['admin', 'moderator', 'user'] as const).map((r) => (
                <span key={r} className={ROLE_COLORS[r]} style={{ width: `${(data.users.byRole[r] / Math.max(1, data.users.total)) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-4 space-y-2.5 text-sm">
              {(['admin', 'moderator', 'user'] as const).map((r) => (
                <li key={r} className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${ROLE_COLORS[r]}`} />
                  <span className="flex-1 capitalize">{r}s</span>
                  <span className="font-medium tabular-nums">{data.users.byRole[r]}</span>
                </li>
              ))}
            </ul>
            <h3 className="mt-6 mb-3 text-sm font-semibold">Top interests</h3>
            <ul className="space-y-2">
              {data.topInterests.slice(0, 5).map((t) => (
                <li key={t.interest} className="text-sm">
                  <div className="flex justify-between">
                    <span>{t.interest}</span>
                    <span className="text-muted-foreground tabular-nums">{t.count}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-brand/70" style={{ width: `${(t.count / Math.max(1, data.topInterests[0]?.count ?? 1)) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Newest members"
            className="col-span-2"
            action={
              people && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin/users?sort=newest">View all</Link>
                </Button>
              )
            }
          >
            <ul className="divide-y divide-border">
              {data.recentSignups.map((u) => {
                const row = (
                  <>
                    <UserAvatar user={u} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {u.name} <RolePill role={u.role} />
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{u.username ? `@${u.username}` : 'no handle'}</p>
                    </div>
                    <div className="text-right">
                      <StatusPill user={u} />
                      <p className="mt-1 text-xs text-muted-foreground">{timeAgo(u.createdAt)}</p>
                    </div>
                  </>
                )
                return (
                  <li key={u.id}>
                    {people ? (
                      <Link to={`/admin/users/${u.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-accent/50">
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 py-2.5">{row}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Panel>

          <Panel
            title="Videos & pipeline"
            className="col-span-2"
            action={
              <Link to="/admin/videos" className="text-xs font-medium text-link hover:underline">
                All videos
              </Link>
            }
          >
            <ul className="grid gap-3 sm:grid-cols-3">
              <li className="rounded-xl border border-border p-4">
                <FilmIcon className="size-5 text-brand" />
                <p className="mt-3 text-sm font-medium">Videos</p>
                <p className="text-xs text-muted-foreground">{formatBytes(data.videos.storageBytes)} in storage</p>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums">{data.videos.total.toLocaleString()}</p>
              </li>
              <li className="rounded-xl border border-border p-4">
                <CpuIcon className="size-5 text-brand" />
                <p className="mt-3 text-sm font-medium">Pipeline</p>
                <p className="text-xs text-muted-foreground">
                  {data.videos.uploading} uploading · {data.videos.processing} processing
                </p>
                <p className="mt-2 font-display text-2xl font-bold tabular-nums">
                  {data.videos.failed > 0 ? (
                    <Link to="/admin/videos?status=failed" className="text-red-600 hover:underline dark:text-red-400">
                      {data.videos.failed} failed
                    </Link>
                  ) : (
                    <span className="text-green-600 dark:text-green-400">0 failed</span>
                  )}
                </p>
              </li>
              <li className="rounded-xl border border-dashed border-border p-4">
                <MessageSquareTextIcon className="size-5 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Ask usage</p>
                <p className="text-xs text-muted-foreground">Questions & tokens · coming soon</p>
                <p className="mt-2 font-display text-2xl font-bold text-muted-foreground/50">—</p>
              </li>
            </ul>
          </Panel>
        </div>
      )}
    </>
  )
}
