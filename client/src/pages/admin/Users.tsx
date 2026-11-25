import { type AdminUserDTO, ROLES, USER_SORTS, USER_STATUSES } from '@reelstack/shared'
import { SearchIcon, UsersIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { listUsers } from '@/api/admin'
import UserActions from '@/components/admin/UserActions'
import { PageHeader, Pagination, RolePill, StatusPill, UserAvatar } from '@/components/admin/parts'
import EmptyState from '@/components/EmptyState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useRequest } from '@/hooks/use-request'
import { timeAgo } from '@/lib/userAgent'
import { cn } from '@/lib/utils'

const SORT_LABELS: Record<(typeof USER_SORTS)[number], string> = { newest: 'Newest', oldest: 'Oldest', name: 'Name A–Z', 'last-login': 'Last login' }
const PAGE_SIZE = 12

function Chips<T extends string>({ value, options, onChange, label }: { value: T | ''; options: readonly T[]; onChange: (v: T | '') => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1 rounded-xl bg-muted/60 p-1">
      {(['', ...options] as const).map((o) => (
        <button
          key={o || 'all'}
          type="button"
          aria-pressed={value === o}
          onClick={() => onChange(o)}
          className={cn(
            'rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors',
            value === o ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o || 'All'}
        </button>
      ))}
    </div>
  )
}

export default function Users() {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebouncedValue(search.trim(), 300)
  const role = (params.get('role') ?? '') as (typeof ROLES)[number] | ''
  const status = (params.get('status') ?? '') as (typeof USER_STATUSES)[number] | ''
  const sort = (USER_SORTS as readonly string[]).includes(params.get('sort') ?? '') ? (params.get('sort') as (typeof USER_SORTS)[number]) : 'newest'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const update = (patch: Record<string, string | number>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v === '' || v === 1 || (k === 'sort' && v === 'newest')) next.delete(k)
          else next.set(k, String(v))
        }
        return next
      },
      { replace: true },
    )

  const query = { q: q || undefined, role: role || undefined, status: status || undefined, sort, page, pageSize: PAGE_SIZE }
  const { data, error, loading, setData } = useRequest(JSON.stringify(query), (signal) => listUsers(query, signal))

  // Mirror the debounced search into the URL (so the view can be shared).
  useEffect(() => {
    setParams(
      (prev) => {
        if ((prev.get('q') ?? '') === q) return prev
        const next = new URLSearchParams(prev)
        if (q) next.set('q', q)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }, [q, setParams])

  const replace = (next: AdminUserDTO) => setData((d) => d && { ...d, items: d.items.map((u) => (u.id === next.id ? next : u)) })
  const filtered = q || role || status

  return (
    <>
      <PageHeader title="Users" description={data ? `${data.total} ${filtered ? 'matching' : 'total'} account${data.total === 1 ? '' : 's'}` : 'Everyone on ReelStack.'} />

      <div className="glass mb-4 flex flex-col gap-3 rounded-2xl p-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              if (page > 1) update({ page: 1 })
            }} placeholder="Search name, email or @handle" className="h-10 rounded-xl pr-9 pl-9" aria-label="Search users" />
          {search && (
            <button type="button" onClick={() => { setSearch(''); update({ page: 1 }) }} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
              <XIcon className="size-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chips label="Role" value={role} options={ROLES} onChange={(v) => update({ role: v, page: 1 })} />
          <Chips label="Status" value={status} options={USER_STATUSES} onChange={(v) => update({ status: v, page: 1 })} />
          <select
            value={sort}
            onChange={(e) => update({ sort: e.target.value, page: 1 })}
            aria-label="Sort"
            className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {USER_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users match">
          Try a different search or clear the filters.
        </EmptyState>
      ) : (
        <div className={cn('transition-opacity', loading && 'opacity-60')}>
          {/* md+: table */}
          <div className="glass hidden overflow-hidden rounded-2xl md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-glass-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Joined</th>
                  <th className="px-4 py-3 font-medium">Last login</th>
                  <th className="hidden px-4 py-3 text-right font-medium xl:table-cell">Devices</th>
                  <th className="w-12 px-2 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                {data.items.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-foreground/[0.03]">
                    <td className="px-4 py-3">
                      <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <UserAvatar user={u} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium hover:underline">{u.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{u.username ? `@${u.username} · ` : ''}{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <RolePill role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill user={u} />
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{timeAgo(u.createdAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : '—'}</td>
                    <td className="hidden px-4 py-3 text-right tabular-nums xl:table-cell">{u.activeSessions}</td>
                    <td className="px-2 py-3 text-right">
                      <UserActions user={u} onChange={replace} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phones: cards */}
          <ul className="space-y-2 md:hidden">
            {data.items.map((u) => (
              <li key={u.id} className="glass flex items-center gap-3 rounded-2xl p-3">
                <Link to={`/admin/users/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar user={u} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{u.name}</span>
                      <RolePill role={u.role} />
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{u.username ? `@${u.username}` : u.email}</span>
                    <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <StatusPill user={u} /> {u.lastLoginAt ? `seen ${timeAgo(u.lastLoginAt)}` : ''}
                    </span>
                  </span>
                </Link>
                <UserActions user={u} onChange={replace} />
              </li>
            ))}
          </ul>

          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: p })} />
        </div>
      )}
      {filtered && data && (
        <Button
          variant="link"
          size="sm"
          className="mt-2 px-0"
          onClick={() => {
            setSearch('')
            update({ q: '', role: '', status: '', page: 1 })
          }}
        >
          Clear filters
        </Button>
      )}
    </>
  )
}
