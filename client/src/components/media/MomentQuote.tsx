import type { MomentDTO } from '@reelstack/shared'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'

import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

import { posterBackground } from './poster-palette'

/** A search result as a pull quote: the words said, then where they were said. */
export default function MomentQuote({ moment, index = 0, className }: { moment: MomentDTO; index?: number; className?: string }) {
  const { video, start, snippet } = moment
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}
      className={cn('list-none', className)}
    >
      <Link
        to={`/watch/${video.id}?t=${start}`}
        className="group relative block h-full overflow-hidden rounded-2xl border border-border bg-card/60 p-6 outline-none transition-colors hover:border-brand/40 focus-visible:ring-2 focus-visible:ring-ring sm:p-8"
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 opacity-80" style={{ background: posterBackground(video.id) }} />
        <blockquote className="font-display text-xl leading-snug font-medium tracking-tight text-balance sm:text-2xl">
          <span className="text-brand">“</span>
          {snippet}
          <span className="text-brand">”</span>
        </blockquote>
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="rounded-full bg-primary/15 px-2 py-0.5 font-mono text-xs font-medium text-link tabular-nums">▸ {formatDuration(start)}</span>
          <span className="font-medium text-foreground underline decoration-border underline-offset-4 group-hover:decoration-brand">{video.title}</span>
          <span className="text-xs tracking-wide uppercase">{video.category}</span>
        </p>
      </Link>
    </motion.li>
  )
}
