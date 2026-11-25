import { CheckIcon, FilmIcon, FlagIcon, MessageSquareIcon, Trash2Icon, UsersIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { DemoBanner, PageHeader } from '@/components/admin/parts'
import EmptyState from '@/components/EmptyState'
import Poster from '@/components/media/Poster'
import { Button } from '@/components/ui/button'
import { DEMO_REPORTS, type DemoReport, type ReportReason } from '@/data/moderation'
import { cn } from '@/lib/utils'

const REASON_TONE: Record<ReportReason, string> = {
  Spam: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Harassment: 'bg-red-500/15 text-red-600 dark:text-red-400',
  Misinformation: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  Copyright: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  Inappropriate: 'bg-pink-500/15 text-pink-700 dark:text-pink-400',
}

const ago = (h: number) => (h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`)

export default function Reports() {
  const [open, setOpen] = useState<DemoReport[]>(DEMO_REPORTS)
  const [resolved, setResolved] = useState(0)

  const resolve = (r: DemoReport, outcome: 'dismissed' | 'removed') => {
    setOpen((list) => list.filter((x) => x.id !== r.id))
    setResolved((n) => n + 1)
    toast.success(outcome === 'removed' ? `${r.kind === 'comment' ? 'Comment' : 'Video'} removed` : 'Report dismissed', {
      action: {
        label: 'Undo',
        onClick: () => {
          setOpen((list) => [...list, r].sort((a, b) => a.hoursAgo - b.hoursAgo))
          setResolved((n) => n - 1)
        },
      },
    })
  }

  return (
    <>
      <PageHeader title="Reports" description={`${open.length} open · ${resolved} resolved this session`} />
      <DemoBanner>Reporting arrives with comments (Phase 4). This queue shows how triage will work.</DemoBanner>

      {open.length === 0 ? (
        <EmptyState icon={CheckIcon} title="Queue is clear">
          Nice work. New reports will appear here.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          <AnimatePresence initial={false}>
            {open.map((r) => (
              <motion.li
                key={r.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 40 }}
                className="glass flex flex-col gap-3 rounded-2xl p-4"
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className={cn('rounded-full px-2 py-0.5 font-medium', REASON_TONE[r.reason])}>
                    <FlagIcon className="mr-1 inline size-3" />
                    {r.reason}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    {r.kind === 'comment' ? <MessageSquareIcon className="size-3.5" /> : <FilmIcon className="size-3.5" />}
                    {r.kind}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
                    <UsersIcon className="size-3.5" /> {r.reporters} · {ago(r.hoursAgo)}
                  </span>
                </div>

                <Link to={`/watch/${r.videoId}`} className="flex items-center gap-3 rounded-xl hover:bg-accent/40">
                  <Poster seed={r.videoId} title="" showTitle={false} className="aspect-video w-24 shrink-0 rounded-lg" />
                  <div className="min-w-0">
                    {r.excerpt ? (
                      <p className="line-clamp-2 text-sm">“{r.excerpt}”</p>
                    ) : (
                      <p className="line-clamp-2 text-sm font-medium">The video itself</p>
                    )}
                    <p className="text-xs text-muted-foreground">by {r.author}</p>
                  </div>
                </Link>

                <p className="text-sm text-muted-foreground">{r.details}</p>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => resolve(r, 'dismissed')}>
                    <CheckIcon /> Dismiss
                  </Button>
                  <Button variant="destructive" size="sm" className="flex-1" onClick={() => resolve(r, 'removed')}>
                    <Trash2Icon /> Remove {r.kind}
                  </Button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </>
  )
}
