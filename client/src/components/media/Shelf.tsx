import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { type ReactNode, useRef } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { VideoCardSkeleton } from './VideoCard'

/** Width of a normal card inside a shelf. */
export const SHELF_ITEM = 'w-[78vw] shrink-0 snap-start sm:w-[300px]'

/** A titled row that scrolls sideways and snaps. Children are `<li>`s. */
export default function Shelf({
  title,
  subtitle,
  href,
  loading = false,
  children,
}: {
  title: string
  subtitle?: string
  href?: string
  loading?: boolean
  children?: ReactNode
}) {
  const scroller = useRef<HTMLUListElement>(null)
  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: 'smooth' })

  return (
    <section aria-label={title}>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-1">
          {href && (
            <Button asChild variant="ghost" size="sm" className="text-link">
              <Link to={href}>See all</Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label={`Scroll ${title} left`} onClick={() => scrollBy(-1)}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex" aria-label={`Scroll ${title} right`} onClick={() => scrollBy(1)}>
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
      <ul ref={scroller} className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-5 overflow-x-auto px-4 pt-4 pb-2 sm:-mx-5 sm:scroll-px-5 sm:px-5">
        {loading
          ? Array.from({ length: 5 }, (_, i) => (
              <li key={i} className={SHELF_ITEM}>
                <VideoCardSkeleton />
              </li>
            ))
          : children}
      </ul>
    </section>
  )
}

/** A shelf item with the standard card width. */
export function ShelfItem({ className, children }: { className?: string; children: ReactNode }) {
  return <li className={cn(SHELF_ITEM, className)}>{children}</li>
}
