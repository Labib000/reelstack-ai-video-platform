import type { AdminUserDTO } from '@reelstack/shared'
import { ChevronLeftIcon, ChevronRightIcon, FlaskConicalIcon, type LucideIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { posterBackground } from '@/components/media/poster-palette'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** A rounded glass panel with an optional title row. */
export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('glass rounded-2xl p-5', className)}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  /** Change vs the previous period; sign decides the arrow colour. */
  delta?: number
  hint?: string
}) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand">
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums sm:mt-3 sm:text-3xl">{value}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        {delta !== undefined && (
          <span className={cn('inline-flex items-center gap-0.5 font-medium', delta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
            {delta >= 0 ? <TrendingUpIcon className="size-3.5" /> : <TrendingDownIcon className="size-3.5" />}
            {delta >= 0 ? '+' : ''}
            {delta}
          </span>
        )}
        {hint}
      </div>
    </div>
  )
}

export function DemoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
      <FlaskConicalIcon className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>
        <span className="font-semibold">Demo data.</span> <span className="text-muted-foreground">{children}</span>
      </p>
    </div>
  )
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

export function UserAvatar({ user, className }: { user: { name: string; avatarUrl: string | null }; className?: string }) {
  return (
    <Avatar className={cn('size-9', className)}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
      <AvatarFallback className="text-xs font-semibold text-white" style={{ background: posterBackground(user.name) }}>
        {initials(user.name)}
      </AvatarFallback>
    </Avatar>
  )
}

export function StatusPill({ user }: { user: Pick<AdminUserDTO, 'bannedAt'> }) {
  return user.bannedAt ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
      <span className="size-1.5 rounded-full bg-current" /> Suspended
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
      <span className="size-1.5 rounded-full bg-current" /> Active
    </span>
  )
}

export function RolePill({ role }: { role: AdminUserDTO['role'] }) {
  return (
    <span
      className={cn(
        'rounded-md px-1.5 py-0.5 text-xs font-medium capitalize',
        role === 'admin' && 'bg-primary text-primary-foreground',
        role === 'moderator' && 'bg-secondary text-secondary-foreground',
        role === 'user' && 'text-muted-foreground',
      )}
    >
      {role}
    </span>
  )
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <p>
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="size-8" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeftIcon />
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="outline" size="icon" className="size-8" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}
