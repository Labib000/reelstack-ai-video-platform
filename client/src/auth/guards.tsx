import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router-dom'

import { safeNext } from '../lib/safeNext.ts'
import { useAuth } from './context.ts'

function FullPageSpinner() {
  return (
    <div className="flex justify-center py-24" role="status" aria-label="Loading">
      <span className="size-6 animate-spin rounded-full border-2 border-neutral-700 border-t-red-500" />
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
