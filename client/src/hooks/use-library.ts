import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/auth/context'
import { EMPTY_LIBRARY, type LibraryList, library } from '@/data/library'

const PROMPTS: Record<LibraryList, string> = {
  watchLater: 'Log in to save videos for later',
  liked: 'Log in to like videos',
  subscriptions: 'Log in to subscribe to channels',
}

/**
 * The signed-in user's library, plus actions. For guests the state is empty
 * and actions show a "Log in" prompt instead (history is simply not kept).
 */
export function useLibrary() {
  const { user } = useAuth()
  const uid = user?.id ?? null
  const navigate = useNavigate()
  const location = useLocation()
  const state = useSyncExternalStore(library.subscribe, () => (uid ? library.get(uid) : EMPTY_LIBRARY))

  const promptLogin = useCallback(
    (message: string) =>
      toast(message, {
        action: {
          label: 'Log in',
          onClick: () => navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`),
        },
      }),
    [navigate, location.pathname, location.search],
  )

  return useMemo(
    () => ({
      signedIn: uid !== null,
      state,
      has: (list: LibraryList, id: string) => state[list].includes(id),
      toggle(list: LibraryList, id: string): boolean | null {
        if (!uid) {
          promptLogin(PROMPTS[list])
          return null
        }
        return library.toggle(uid, list, id)
      },
      recordView: (id: string, progress: number) => uid && library.recordView(uid, id, progress),
      removeFromHistory: (id: string) => uid && library.removeFromHistory(uid, id),
      clearHistory: () => uid && library.clearHistory(uid),
      setHistoryPaused: (paused: boolean) => uid && library.setHistoryPaused(uid, paused),
    }),
    [uid, state, promptLogin],
  )
}
