import type { VideoDetailDTO } from '@reelstack/shared'
import { PlayIcon, SparklesIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDuration } from '@/lib/format'

import Poster from './Poster'
import { posterBackground } from './poster-palette'

const ROTATE_MS = 8000

/** The home page's featured stage: a big poster that cycles, glowing in its own colours. */
export default function Stage({ videos }: { videos: VideoDetailDTO[] | null }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!videos || videos.length < 2 || paused) return
    const timer = setTimeout(() => setIndex((i) => (i + 1) % videos.length), ROTATE_MS)
    return () => clearTimeout(timer)
  }, [videos, paused, index])

  if (!videos) return <Skeleton className="h-[min(60vh,520px)] min-h-[440px] rounded-3xl" />

  const video = videos[index]!
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured videos"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <AnimatePresence>
        <motion.div
          key={`glow-${video.id}`}
          aria-hidden
          className="absolute -inset-6 -z-10 rounded-[3rem] blur-3xl saturate-150"
          style={{ background: posterBackground(video.id) }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.45 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        />
      </AnimatePresence>

      <div className="relative h-[min(60vh,520px)] min-h-[440px] overflow-hidden rounded-3xl ring-1 ring-white/10">
        <AnimatePresence initial={false}>
          <motion.div
            key={video.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <Poster seed={video.id} title={video.title} showTitle={false} className="size-full" />
          </motion.div>
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />

        <AnimatePresence mode="wait">
          <motion.div
            key={video.id}
            className="absolute inset-0 flex flex-col justify-end gap-4 p-6 pt-14 text-white sm:p-10 [&>*]:shrink-0"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <span className="w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide uppercase backdrop-blur">
              Featured · {video.category}
            </span>
            <h1 className="max-w-3xl font-display text-3xl leading-[1.02] font-bold tracking-tight text-balance sm:text-5xl xl:text-6xl">{video.title}</h1>
            <p className="text-sm text-white/75">
              {video.channel.name} · {formatDuration(video.durationSec)} · {video.chapters.length} chapters
            </p>
            {video.summary && <p className="line-clamp-2 max-w-2xl text-sm text-white/85 sm:text-base">{video.summary}</p>}
            <div className="flex flex-wrap gap-3 pt-1">
              <Button asChild size="lg" className="rounded-full">
                <Link to={`/watch/${video.id}`}>
                  <PlayIcon className="fill-current" /> Watch now
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white">
                <Link to={`/watch/${video.id}?panel=ask`}>
                  <SparklesIcon /> Ask this video
                </Link>
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>

        {videos.length > 1 && (
          <div className="absolute top-6 right-6 flex gap-2 sm:top-auto sm:right-10 sm:bottom-10">
            {videos.map((v, i) => (
              <button
                key={v.id}
                type="button"
                aria-label={`Show ${v.title}`}
                aria-current={i === index}
                onClick={() => setIndex(i)}
                className="relative h-1.5 w-8 overflow-hidden rounded-full bg-white/25"
              >
                {i === index && <motion.span layoutId="stage-dot" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
