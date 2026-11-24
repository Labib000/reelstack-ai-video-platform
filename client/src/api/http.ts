import type { ApiErrorBody, AuthResponse } from '@reelstack/shared'
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

/**
 * The access token lives only in this module's memory: never localStorage or
 * sessionStorage, where any injected script could read it. A reload loses it,
 * and AuthProvider gets a new one from the httpOnly refresh cookie.
 */
let accessToken: string | null = null

export const getAccessToken = () => accessToken
export function setAccessToken(token: string | null) {
  accessToken = token
}

/** Header the server requires on cookie-authenticated routes (CSRF). */
export const CSRF_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' }

/** Every API call goes through this instance. */
export const api = axios.create({ baseURL: '/api', withCredentials: true })

/**
 * Used only for /auth/refresh. A separate instance, so a failed refresh
 * never goes through the 401 interceptor below (no refresh loop).
 */
export const refreshClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: CSRF_HEADERS,
})

let sessionExpiredHandler: (() => void) | null = null

/** AuthProvider registers what happens when a refresh fails mid-session. */
export function onSessionExpired(handler: () => void) {
  sessionExpiredHandler = handler
  return () => {
    if (sessionExpiredHandler === handler) sessionExpiredHandler = null
  }
}

/** Runs `fn` while holding a lock shared by every tab of this site. */
function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  return locks ? locks.request('reelstack-refresh', fn) : fn()
}

let inflight: Promise<AuthResponse> | null = null

/**
 * Swaps the refresh cookie for a new access token. Single-flight:
 *
 * - In this tab, every caller (queued 401s, StrictMode's double effect) gets
 *   the same promise, so there is one /refresh call.
 * - Across tabs, a Web Lock makes them take turns. The cookie is shared, so
 *   the second tab refreshes with the cookie the first one just rotated.
 *
 * Two parallel refreshes with the same cookie would look like token theft to
 * the server, which then revokes the whole session.
 */
export function refreshSession(): Promise<AuthResponse> {
  inflight ??= withRefreshLock(async () => {
    const res = await refreshClient.post<AuthResponse>('/auth/refresh')
    setAccessToken(res.data.accessToken)
    return res.data
  }).finally(() => {
    inflight = null
  })
  return inflight
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.set('Authorization', `Bearer ${accessToken}`)
  return config
})

/** Endpoints whose 401 means "wrong credentials", not "token expired". */
const NO_REFRESH = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'])

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean }

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!(error instanceof AxiosError) || error.response?.status !== 401 || !error.config) {
    throw error
  }

  const config = error.config as RetriableConfig
  const sentAuth = config.headers.get('Authorization')
  if (!sentAuth || config._retried || NO_REFRESH.has(config.url ?? '')) throw error

  config._retried = true

  // Another request already refreshed while this one was in flight: just retry.
  if (accessToken && sentAuth !== `Bearer ${accessToken}`) return api(config)

  try {
    await refreshSession()
  } catch {
    // Only the first failing request reports it; the rest see the token gone.
    if (accessToken !== null) {
      setAccessToken(null)
      sessionExpiredHandler?.()
    }
    throw error
  }

  return api(config)
})

export interface ApiErrorInfo {
  /** HTTP status, or null for a network error. */
  status: number | null
  message: string
  /** Per-field messages from a 422 (or 429 on login). */
  fieldErrors: Record<string, string>
}

/** Turns any thrown value from an API call into something a form can show. */
export function apiError(error: unknown): ApiErrorInfo {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return { status: null, message: 'Cannot reach the server. Check your connection.', fieldErrors: {} }
    }
    const body = error.response.data as Partial<ApiErrorBody> | undefined
    return {
      status: error.response.status,
      message: body?.message ?? `Request failed (${error.response.status}).`,
      fieldErrors: body?.errors ?? {},
    }
  }
  return { status: null, message: 'Something went wrong.', fieldErrors: {} }
}
