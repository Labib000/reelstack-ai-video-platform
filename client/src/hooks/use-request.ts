import { useCallback, useEffect, useRef, useState } from 'react'

import { apiError } from '@/api/http'

export interface RequestState<T> {
  data: T | undefined
  error: string | null
  /** True until the first response for the current key arrives. */
  loading: boolean
  reload: () => void
  /** Replace the data locally (optimistic updates). */
  setData: (update: (prev: T | undefined) => T | undefined) => void
}

/**
 * Loads `load()` whenever `key` changes (or on reload), aborting stale
 * requests. While a new key loads, the previous data stays visible.
 */
export function useRequest<T>(key: string, load: (signal: AbortSignal) => Promise<T>): RequestState<T> {
  const loader = useRef(load)
  useEffect(() => {
    loader.current = load
  })
  const [version, setVersion] = useState(0)
  const [state, setState] = useState<{ key: string; data?: T; error: string | null }>({ key: '', error: null })
  const current = `${key}#${version}`

  useEffect(() => {
    const controller = new AbortController()
    loader
      .current(controller.signal)
      .then((data) => setState({ key: current, data, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState((s) => ({ ...s, key: current, error: apiError(error).message }))
      })
    return () => controller.abort()
  }, [current])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const setData = useCallback((update: (prev: T | undefined) => T | undefined) => setState((s) => ({ ...s, data: update(s.data) })), [])

  return { data: state.data, error: state.key === current ? state.error : null, loading: state.key !== current, reload, setData }
}
