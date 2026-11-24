import { useSyncExternalStore } from 'react'

/**
 * Light / dark / system theme (adapted from Hisaab-mern). ReelStack defaults
 * to dark. index.html applies the stored choice before first paint, so there
 * is no white flash; this module keeps it in sync afterwards.
 */
export type ResolvedAppearance = 'light' | 'dark'
export type Appearance = ResolvedAppearance | 'system'

const STORAGE_KEY = 'appearance'
const DEFAULT: Appearance = 'dark'

const listeners = new Set<() => void>()
let current: Appearance = DEFAULT

const media = () => (typeof window === 'undefined' ? null : window.matchMedia('(prefers-color-scheme: dark)'))

function readStored(): Appearance {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' || value === 'system' ? value : DEFAULT
  } catch {
    return DEFAULT
  }
}

const resolve = (appearance: Appearance): ResolvedAppearance =>
  appearance === 'system' ? (media()?.matches ? 'dark' : 'light') : appearance

function apply(appearance: Appearance) {
  const dark = resolve(appearance) === 'dark'
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
}

const notify = () => listeners.forEach((listener) => listener())

/** Call once before rendering. */
export function initializeTheme() {
  current = readStored()
  apply(current)
  media()?.addEventListener('change', () => {
    if (current === 'system') {
      apply(current)
      notify()
    }
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useAppearance() {
  const appearance = useSyncExternalStore(subscribe, () => current, () => DEFAULT)

  const updateAppearance = (mode: Appearance) => {
    current = mode
    try {
      localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      // Private mode / blocked storage: the choice just won't persist.
    }
    apply(mode)
    notify()
  }

  return { appearance, resolvedAppearance: resolve(appearance), updateAppearance } as const
}
