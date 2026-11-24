import { type Permission, can } from '@reelstack/shared'
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'

import { Spinner } from '@/components/ui/spinner'
import { safeNext } from '@/lib/safeNext'
import { useAuth } from './context'

function FullPageSpinner() {
  return (
    <div className="flex justify-center py-24 text-muted-foreground" role="status" aria-label="Loading">
      <Spinner className="size-6" />
    </div>
  )
}

/** Signed-in users only; guests go to /login and come back afterwards. */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'guest') {
    const next = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  return <Outlet />
}

/**
 * Guests only (login, register). Signed-in users go to `?next=` (checked by
 * safeNext) or home, which is also what sends them on right after logging in.
 */
export function RequireGuest() {
  const { status } = useAuth()
  const [params] = useSearchParams()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'authenticated') return <Navigate to={safeNext(params.get('next'))} replace />
  return <Outlet />
}

/** Signed-in users whose role grants `permission`; others see a 404. */
export function RequirePermission({ permission, fallback }: { permission: Permission; fallback: React.ReactNode }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageSpinner />
  if (status === 'guest') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  }
  return can(user?.role, permission) ? <Outlet /> : fallback
}
