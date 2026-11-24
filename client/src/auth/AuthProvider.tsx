import type { AuthResponse, LoginInput, RegisterInput, UserDTO } from '@reelstack/shared'
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CSRF_HEADERS, api, onSessionExpired, refreshSession, setAccessToken } from '../api/http.ts'
import { AuthContext, type AuthContextValue, type AuthStatus } from './context.ts'

type Message = { type: 'login' } | { type: 'logout' }

interface State {
  status: AuthStatus
  user: UserDTO | null
}

const GUEST: State = { status: 'guest', user: null }

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading', user: null })
  const navigate = useNavigate()
  const channel = useRef<BroadcastChannel | null>(null)

  const signedIn = useCallback((data: AuthResponse) => {
    setAccessToken(data.accessToken)
    setState({ status: 'authenticated', user: data.user })
  }, [])

  const signedOut = useCallback(() => {
    setAccessToken(null)
    setState(GUEST)
  }, [])

  // On load: the access token was only in memory, so get a new one from the
  // refresh cookie. StrictMode runs this twice in dev; refreshSession is
  // single-flight, so that is still one /refresh request.
  useEffect(() => {
    let cancelled = false
    refreshSession()
      .then((data) => !cancelled && signedIn(data))
      .catch(() => !cancelled && setState(GUEST))
    return () => {
      cancelled = true
    }
  }, [signedIn])

  // A refresh failed mid-session (expired, revoked, or reuse detected).
  useEffect(
    () =>
      onSessionExpired(() => {
        signedOut()
        const here = `${window.location.pathname}${window.location.search}`
        navigate(`/login?next=${encodeURIComponent(here)}`, { replace: true })
      }),
    [navigate, signedOut],
  )

  // Keep tabs in step: log in or out in one tab and the others follow.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const bc = new BroadcastChannel('reelstack-auth')
    channel.current = bc
    bc.onmessage = (event: MessageEvent<Message>) => {
      if (event.data.type === 'logout') {
        signedOut()
      } else if (event.data.type === 'login') {
        // The cookie is shared, so this tab can pick up the new session.
        refreshSession().then(signedIn).catch(() => {})
      }
    }
    return () => {
      bc.close()
      channel.current = null
    }
  }, [signedIn, signedOut])

  const broadcast = (message: Message) => channel.current?.postMessage(message)

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      async login(input: LoginInput) {
        const res = await api.post<AuthResponse>('/auth/login', input)
        signedIn(res.data)
        broadcast({ type: 'login' })
      },
      async register(input: RegisterInput) {
        const res = await api.post<AuthResponse>('/auth/register', input)
        signedIn(res.data)
        broadcast({ type: 'login' })
      },
      async logout() {
        try {
          await api.post('/auth/logout', null, { headers: CSRF_HEADERS })
        } finally {
          signedOut()
          broadcast({ type: 'logout' })
          navigate('/login', { replace: true })
        }
      },
      async logoutAll() {
        try {
          await api.post('/auth/logout-all')
        } finally {
          signedOut()
          broadcast({ type: 'logout' })
          navigate('/login', { replace: true })
        }
      },
    }),
    [state, signedIn, signedOut, navigate],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
