import type { AuthResponse } from '@reelstack/shared'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api, getAccessToken, onSessionExpired, refreshClient, setAccessToken } from './http.ts'

type Reply = { status: number; data?: unknown }

/** An axios adapter that answers with `handler`, throwing like axios on >= 400. */
function adapter(handler: (config: InternalAxiosRequestConfig) => Reply | Promise<Reply>): AxiosAdapter {
  return async (config) => {
    await new Promise((r) => setTimeout(r, 5))
    const { status, data = {} } = await handler(config)
    const response = { status, data, statusText: '', headers: {}, config }
    if (status >= 400) {
      throw new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', config, null, response)
    }
    return response
  }
}

const authResponse = (accessToken: string): AuthResponse => ({
  accessToken,
  user: { id: 'u1', name: 'Ada', username: 'ada', email: 'ada@example.com', role: 'user', avatarUrl: null, createdAt: '' },
})

/** API that accepts only `Bearer new`. */
const apiAcceptingNewToken = adapter((config) =>
  config.headers.get('Authorization') === 'Bearer new' ? { status: 200, data: { ok: true } } : { status: 401 },
)

beforeEach(() => {
  setAccessToken('old')
})

afterEach(() => {
  setAccessToken(null)
  api.defaults.adapter = undefined
  refreshClient.defaults.adapter = undefined
})

describe('401 handling', () => {
  it('refreshes exactly once for parallel 401s and retries them all', async () => {
    const refresh = vi.fn(() => ({ status: 200, data: authResponse('new') }))
    api.defaults.adapter = apiAcceptingNewToken
    refreshClient.defaults.adapter = adapter(refresh)

    const results = await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(results.map((r) => r.status)).toEqual([200, 200, 200])
    expect(getAccessToken()).toBe('new')
  })

  it('sends the CSRF header on refresh', async () => {
    let header: unknown
    api.defaults.adapter = apiAcceptingNewToken
    refreshClient.defaults.adapter = adapter((config) => {
      header = config.headers.get('X-Requested-With')
      return { status: 200, data: authResponse('new') }
    })

    await api.get('/a')
    expect(header).toBe('XMLHttpRequest')
  })

  it('reports an expired session once when the refresh fails', async () => {
    const expired = vi.fn()
    const unsubscribe = onSessionExpired(expired)
    api.defaults.adapter = apiAcceptingNewToken
    refreshClient.defaults.adapter = adapter(() => ({ status: 401 }))

    const results = await Promise.allSettled([api.get('/a'), api.get('/b')])

    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect(expired).toHaveBeenCalledTimes(1)
    expect(getAccessToken()).toBeNull()
    unsubscribe()
  })

  it('does not refresh on a 401 from login', async () => {
    const refresh = vi.fn(() => ({ status: 200, data: authResponse('new') }))
    api.defaults.adapter = adapter(() => ({ status: 401, data: { message: 'Invalid email or password.' } }))
    refreshClient.defaults.adapter = adapter(refresh)

    await expect(api.post('/auth/login', {})).rejects.toBeInstanceOf(AxiosError)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('retries only once, even if the new token is rejected too', async () => {
    const calls = vi.fn(() => ({ status: 401 }))
    api.defaults.adapter = adapter(calls)
    refreshClient.defaults.adapter = adapter(() => ({ status: 200, data: authResponse('new') }))

    await expect(api.get('/a')).rejects.toBeInstanceOf(AxiosError)
    expect(calls).toHaveBeenCalledTimes(2)
  })

  it('does not refresh for guests (no token sent)', async () => {
    setAccessToken(null)
    const refresh = vi.fn(() => ({ status: 200, data: authResponse('new') }))
    api.defaults.adapter = adapter(() => ({ status: 401 }))
    refreshClient.defaults.adapter = adapter(refresh)

    await expect(api.get('/a')).rejects.toBeInstanceOf(AxiosError)
    expect(refresh).not.toHaveBeenCalled()
  })
})
