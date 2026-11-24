import type { SessionDTO } from '@reelstack/shared'
import { useCallback, useEffect, useState } from 'react'

import { api, apiError } from '../api/http.ts'
import { useAuth } from '../auth/context.ts'
import { describeUserAgent, timeAgo } from '../lib/userAgent.ts'

export default function Sessions() {
  const { user, logout, logoutAll } = useAuth()
  const [sessions, setSessions] = useState<SessionDTO[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    () =>
      api.get<{ sessions: SessionDTO[] }>('/auth/sessions').then(
        (res) => {
          setSessions(res.data.sessions)
          setError(null)
        },
        (err: unknown) => setError(apiError(err).message),
      ),
    [],
  )

  useEffect(() => {
    void load()
  }, [load])

  async function signOut(session: SessionDTO) {
    if (session.current) {
      await logout()
      return
    }
    setBusy(session.familyId)
    try {
      await api.delete(`/auth/sessions/${encodeURIComponent(session.familyId)}`)
      await load()
    } catch (err) {
      setError(apiError(err).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your sessions</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Signed in as {user?.name} ({user?.email})
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logoutAll()}
          className="rounded-md border border-red-500/50 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10"
        >
          Sign out everywhere
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {sessions === null ? (
        <p className="text-neutral-400">Loading…</p>
      ) : (
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
          {sessions.map((s) => (
            <li key={s.familyId} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium">
                  {describeUserAgent(s.userAgent)}
                  {s.current && (
                    <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-xs text-green-400">This device</span>
                  )}
                </p>
                <p className="truncate text-sm text-neutral-500">
                  {s.ip ?? 'Unknown IP'} · signed in {timeAgo(s.createdAt)} · last active {timeAgo(s.lastUsedAt)}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === s.familyId}
                onClick={() => void signOut(s)}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
              >
                Sign out
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
