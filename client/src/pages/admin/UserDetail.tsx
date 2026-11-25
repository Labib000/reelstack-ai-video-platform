import { can } from '@reelstack/shared'
import { ArrowLeftIcon, CalendarIcon, ClockIcon, LaptopIcon, MailIcon, UserXIcon } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { getUser, listAudit } from '@/api/admin'
import { useAuth } from '@/auth/context'
import UserActions from '@/components/admin/UserActions'
import { Panel, RolePill, StatusPill, UserAvatar } from '@/components/admin/parts'
import EmptyState from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useRequest } from '@/hooks/use-request'
import { describeAudit } from '@/lib/audit'
import { timeAgo } from '@/lib/userAgent'

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export default function UserDetail() {
  const { id = '' } = useParams()
  const { user: me } = useAuth()
  const user = useRequest(`user-${id}`, (signal) => getUser(id, signal))
  const history = useRequest(`user-audit-${id}-${user.data?.role}-${user.data?.bannedAt}-${user.data?.activeSessions}`, (signal) =>
    can(me?.role, 'audit:view') ? listAudit({ target: id, pageSize: 20 }, signal) : Promise.resolve(null),
  )

  if (user.error && !user.data)
    return (
      <EmptyState icon={UserXIcon} title="User not found">
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link to="/admin/users">Back to users</Link>
        </Button>
      </EmptyState>
    )
  if (!user.data) return <Skeleton className="h-96 rounded-2xl" />
  const u = user.data

  const facts = [
    { icon: MailIcon, label: 'Email', value: u.email },
    { icon: CalendarIcon, label: 'Joined', value: `${dateFmt.format(new Date(u.createdAt))} · ${timeAgo(u.createdAt)}` },
    { icon: ClockIcon, label: 'Last login', value: u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Not recorded' },
    { icon: LaptopIcon, label: 'Signed-in devices', value: String(u.activeSessions) },
  ]

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link to="/admin/users">
          <ArrowLeftIcon /> All users
        </Link>
      </Button>

      <div className="glass relative mb-4 overflow-hidden rounded-3xl p-6">
        <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar user={u} className="size-16 text-lg ring-4 ring-background" />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl font-bold">
              {u.name} <RolePill role={u.role} /> <StatusPill user={u} />
            </h1>
            <p className="text-sm text-muted-foreground">{u.username ? `@${u.username}` : 'No username (older account)'}</p>
          </div>
        </div>
        {u.bannedAt && (
          <p className="relative mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            Suspended {timeAgo(u.bannedAt)}
            {u.banReason && <>: “{u.banReason}”</>}
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Account">
            <dl className="grid gap-4 sm:grid-cols-2">
              {facts.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="truncate text-sm font-medium">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <h3 className="mt-6 mb-2 text-xs text-muted-foreground">Interests</h3>
            <div className="flex flex-wrap gap-1.5">
              {u.interests.length ? (
                u.interests.map((i) => (
                  <span key={i} className="rounded-full border border-border px-2.5 py-0.5 text-xs">
                    {i}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">None picked</span>
              )}
            </div>
          </Panel>

          {history.data !== null && (
            <Panel title="History">
              {!history.data ? (
                <Skeleton className="h-24 rounded-xl" />
              ) : history.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No admin actions on this account yet.</p>
              ) : (
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {history.data.items.map((e) => (
                    <li key={e.id} className="relative">
                      <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-brand" />
                      <p className="text-sm">{describeAudit(e)}</p>
                      {e.meta.reason && <p className="text-xs text-muted-foreground">“{e.meta.reason}”</p>}
                      <p className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          )}
        </div>

        <Panel title="Actions" className="h-fit">
          <UserActions user={u} onChange={(next) => user.setData(() => next)} showView={false} variant="buttons" />
        </Panel>
      </div>
    </>
  )
}
