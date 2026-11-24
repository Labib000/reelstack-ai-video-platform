import type { SessionDTO } from '@reelstack/shared'
import { LogOutIcon, MonitorIcon, SmartphoneIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { api, apiError } from '@/api/http'
import { useAuth } from '@/auth/context'
import { RoleBadge } from '@/components/UserMenu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { describeUserAgent, isMobileUserAgent, timeAgo } from '@/lib/userAgent'

export default function Sessions() {
  const { user, logout, logoutAll } = useAuth()
  const [sessions, setSessions] = useState<SessionDTO[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(
    () =>
      api.get<{ sessions: SessionDTO[] }>('/auth/sessions').then(
        (res) => setSessions(res.data.sessions),
        (err: unknown) => toast.error(apiError(err).message),
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
      setSessions((list) => list?.filter((s) => s.familyId !== session.familyId) ?? null)
      toast.success(`Signed out of ${describeUserAgent(session.userAgent)}`)
    } catch (err) {
      toast.error(apiError(err).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            Your sessions {user && <RoleBadge role={user.role} />}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Devices signed in as {user?.email}. Sign out any you don't recognise.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive-foreground">
              <LogOutIcon />
              Sign out everywhere
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of every device?</AlertDialogTitle>
              <AlertDialogDescription>
                All sessions end immediately, including this one. You'll need to log in again everywhere.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void logoutAll()}>Sign out everywhere</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Card className="py-2">
        <CardHeader className="sr-only">
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>One row per signed-in device</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {sessions === null ? (
            <ul className="divide-y">
              {[0, 1].map((i) => (
                <li key={i} className="flex items-center gap-4 px-6 py-4">
                  <Skeleton className="size-9 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="divide-y">
              <AnimatePresence initial={false}>
                {sessions.map((s) => {
                  const Icon = isMobileUserAgent(s.userAgent) ? SmartphoneIcon : MonitorIcon
                  return (
                    <motion.li
                      key={s.familyId}
                      layout
                      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
                      className="flex items-center gap-4 px-6 py-4"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium">
                          {describeUserAgent(s.userAgent)}
                          {s.current && (
                            <Badge variant="secondary" className="text-green-600 dark:text-green-400">
                              This device
                            </Badge>
                          )}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {s.ip ?? 'Unknown IP'} · signed in {timeAgo(s.createdAt)} · active {timeAgo(s.lastUsedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === s.familyId}
                        onClick={() => void signOut(s)}
                      >
                        {busy === s.familyId && <Spinner />}
                        Sign out
                      </Button>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
