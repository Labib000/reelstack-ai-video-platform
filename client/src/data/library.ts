import { CONTINUE_WATCHING } from './catalog'

/**
 * Per-user library: watch history, Watch later, likes and subscriptions.
 * Kept in localStorage until Phase 4 moves it to the API; components only
 * talk to it through hooks/use-library.ts, so that swap stays local.
 */

export interface HistoryEntry {
  id: string
  watchedAt: string
  /** 0–1 through the video. */
  progress: number
}

export interface LibraryState {
  history: HistoryEntry[]
  historyPaused: boolean
  watchLater: string[]
  liked: string[]
  subscriptions: string[]
}

export type LibraryList = 'watchLater' | 'liked' | 'subscriptions'

const HISTORY_LIMIT = 200

export const EMPTY_LIBRARY: LibraryState = Object.freeze({
  history: [],
  historyPaused: false,
  watchLater: [],
  liked: [],
  subscriptions: [],
}) as LibraryState

/** Sample state so a new account's pages aren't empty in the demo. */
export function demoLibrary(now = Date.now()): LibraryState {
  const hour = 3_600_000
  return {
    history: Object.entries(CONTINUE_WATCHING).map(([id, progress], i) => ({
      id,
      progress,
      watchedAt: new Date(now - [2, 20, 30, 80][i]! * hour).toISOString(),
    })),
    historyPaused: false,
    watchLater: ['consensus', 'light-shadow'],
    liked: ['black-holes', 'calm-interfaces'],
    subscriptions: ['c-lab', 'c-frame'],
  }
}

interface Storage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function createLibraryStore(storage: Storage | null, seed: () => LibraryState = () => EMPTY_LIBRARY) {
  const cache = new Map<string, LibraryState>()
  const listeners = new Set<() => void>()
  const key = (uid: string) => `reelstack:library:${uid}`

  function get(uid: string): LibraryState {
    const cached = cache.get(uid)
    if (cached) return cached
    let state: LibraryState | null = null
    try {
      const raw = storage?.getItem(key(uid))
      if (raw) state = { ...EMPTY_LIBRARY, ...(JSON.parse(raw) as Partial<LibraryState>) }
    } catch {
      // Unreadable or blocked storage: start fresh.
    }
    state ??= seed()
    cache.set(uid, state)
    return state
  }

  function set(uid: string, update: (s: LibraryState) => LibraryState) {
    const next = update(get(uid))
    cache.set(uid, next)
    try {
      storage?.setItem(key(uid), JSON.stringify(next))
    } catch {
      // Storage full or blocked: keep the in-memory copy.
    }
    listeners.forEach((l) => l())
  }

  return {
    get,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    /** Another tab changed storage: drop the cache and re-read. */
    invalidate() {
      cache.clear()
      listeners.forEach((l) => l())
    },
    recordView(uid: string, id: string, progress: number, now = new Date()) {
      set(uid, (s) =>
        s.historyPaused
          ? s
          : {
              ...s,
              history: [
                { id, progress: Math.min(1, Math.max(0, progress)), watchedAt: now.toISOString() },
                ...s.history.filter((h) => h.id !== id),
              ].slice(0, HISTORY_LIMIT),
            },
      )
    },
    removeFromHistory(uid: string, id: string) {
      set(uid, (s) => ({ ...s, history: s.history.filter((h) => h.id !== id) }))
    },
    clearHistory(uid: string) {
      set(uid, (s) => ({ ...s, history: [] }))
    },
    setHistoryPaused(uid: string, paused: boolean) {
      set(uid, (s) => ({ ...s, historyPaused: paused }))
    },
    /** Adds to the front of the list, or removes if already there. Returns the new membership. */
    toggle(uid: string, list: LibraryList, id: string): boolean {
      const had = get(uid)[list].includes(id)
      set(uid, (s) => ({ ...s, [list]: had ? s[list].filter((x) => x !== id) : [id, ...s[list]] }))
      return !had
    },
  }
}

export const library = createLibraryStore(typeof window === 'undefined' ? null : window.localStorage, () => demoLibrary())

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('reelstack:library:')) library.invalidate()
  })
}
