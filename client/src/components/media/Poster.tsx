import { cn } from '@/lib/utils'

import { posterBackground } from './poster-palette'

/**
 * Generated poster art for a video without a thumbnail: a seeded gradient,
 * film grain and big display type. Text scales with the poster (container
 * query units), so the same component works for cards and the stage.
 */
export default function Poster({
  seed,
  title,
  label,
  thumbnailUrl,
  showTitle = true,
  className,
}: {
  seed: string
  title: string
  label?: string
  thumbnailUrl?: string | null
  showTitle?: boolean
  className?: string
}) {
  return (
    <div className={cn('@container grain relative isolate overflow-hidden', className)} style={{ background: posterBackground(seed) }}>
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <>
          {/* A soft light streak, like a projector beam. */}
          <div className="absolute -inset-x-1/4 top-1/3 h-1/3 -rotate-12 bg-white/10 blur-2xl" />
          {label && (
            <span className="absolute top-[6cqw] left-[6cqw] text-[3.4cqw] font-semibold tracking-[0.2em] text-white/70 uppercase">
              {label}
            </span>
          )}
          {showTitle && (
            <p className="absolute right-[8cqw] bottom-[6cqw] left-[6cqw] line-clamp-3 font-display text-[8.5cqw] leading-[0.95] font-bold tracking-tight text-balance text-white/95 drop-shadow-sm">
              {title}
            </p>
          )}
        </>
      )}
    </div>
  )
}
