import { ArrowLeftIcon, BookmarkIcon, ListOrderedIcon, PlayIcon, SparklesIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Poster from '@/components/media/Poster'
import { cn } from '@/lib/utils'

const COLUMNS = [
  ['black-holes', 'jwt-rotation', 'searing-science'],
  ['cinema-cuts', 'transformers', 'light-shadow'],
  ['hls-ffmpeg', 'calm-interfaces', 'rust-ownership'],
]
const TITLES: Record<string, string> = {
  'black-holes': 'Black holes: what we actually know',
  'jwt-rotation': 'Refresh-token rotation, explained',
  'searing-science': 'The science of a perfect sear',
  'cinema-cuts': 'A history of cinema in twelve cuts',
  transformers: 'How transformers pay attention',
  'light-shadow': 'Learning to see light',
  'hls-ffmpeg': 'Adaptive HLS with FFmpeg',
  'calm-interfaces': 'Designing calm interfaces',
  'rust-ownership': 'Rust ownership in 40 minutes',
}

const QUESTION = 'What happens if a refresh token is stolen?'
const ANSWER = 'The thief can use it once. When either of you presents an already-rotated token, the whole session family is revoked.'

/** Types the demo answer out, pauses, then starts again. */
function useTypedAnswer() {
  const reduce = useReducedMotion()
  const [chars, setChars] = useState(0)
  useEffect(() => {
    if (reduce) return
    const done = chars >= ANSWER.length
    const timer = setTimeout(() => setChars(done ? 0 : chars + 2), done ? 4500 : chars === 0 ? 1200 : 28)
    return () => clearTimeout(timer)
  }, [chars, reduce])
  return reduce ? ANSWER.length : chars
}

function DemoCard() {
  const chars = useTypedAnswer()
  const done = chars >= ANSWER.length
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 text-xs text-white/60">
        <SparklesIcon className="size-3.5 text-brand" /> Ask this video · Refresh-token rotation
      </div>
      <p className="mt-3 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-white">{QUESTION}</p>
      <p className="mt-3 h-[3.25rem] text-sm leading-relaxed text-white/90">
        {ANSWER.slice(0, chars)}
        {!done && <span className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse bg-white/70" />}
      </p>
      <div className={cn('mt-2 flex gap-2 transition-opacity duration-500', done ? 'opacity-100' : 'opacity-0')}>
        {['22:20', '27:00'].map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/25 px-2 py-0.5 font-mono text-xs text-red-200">
            <PlayIcon className="size-2.5 fill-current" />
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}

const POINTS = [
  { icon: SparklesIcon, text: 'Answers that cite the exact second' },
  { icon: ListOrderedIcon, text: 'Chapters and searchable transcripts' },
  { icon: BookmarkIcon, text: 'Save, like and follow your channels' },
]

/** The white wordmark; the showcase is always dark, whatever the theme. */
function WhiteWordmark() {
  return (
    <picture className="block h-8">
      <source type="image/webp" srcSet="/brand/wordmark-dark.webp 2x, /brand/wordmark-dark@3x.webp 3x" />
      <img src="/brand/wordmark-dark.png" alt="ReelStack" className="h-full w-auto select-none" draggable={false} />
    </picture>
  )
}

/** The big left half of the auth screens on desktop: drifting screens, tagline, live demo. */
export default function AuthShowcase({ className }: { className?: string }) {
  return (
    <aside className={cn('relative isolate h-svh overflow-hidden bg-zinc-950 text-white', className)} aria-label="About ReelStack">
      {/* Drifting wall of tilted, text-free screens: ambience, not content. */}
      <div aria-hidden className="absolute -inset-x-10 -inset-y-24 -z-20 grid grid-cols-3 gap-6 opacity-45 blur-[1px]" style={{ perspective: 1200 }}>
        {COLUMNS.map((column, i) => (
          <motion.div
            key={i}
            className="flex flex-col gap-6"
            style={{ rotateY: -14, rotateX: 6 }}
            animate={{ y: i % 2 === 0 ? [0, -60, 0] : [-60, 0, -60] }}
            transition={{ duration: 22 + i * 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {[...column, ...column].map((id, j) => (
              <Poster key={`${id}-${j}`} seed={id} title={TITLES[id] ?? ''} showTitle={false} className="aspect-video shrink-0 rounded-xl ring-1 ring-white/10" />
            ))}
          </motion.div>
        ))}
      </div>
      {/* Fades: top and bottom edges, a left wash behind the copy, and a vignette. */}
      <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-2/5 bg-gradient-to-b from-zinc-950 via-zinc-950/70 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-zinc-950/80 via-zinc-950/40 to-zinc-950/60" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_30%_55%,rgb(247_30_37/0.14),transparent_60%)]" />

      <div className="flex h-full flex-col p-10 xl:p-14">
        <header className="flex items-center justify-between">
          <Link to="/" aria-label="ReelStack home" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white/60">
            <WhiteWordmark />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white/80 backdrop-blur transition-colors hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none"
          >
            <ArrowLeftIcon className="size-3.5" /> Back to browsing
          </Link>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-8 py-10">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs font-medium text-red-200">
            <SparklesIcon className="size-3.5 text-brand" /> Ask the video · new
          </span>
          <h2 className="-mt-2 max-w-xl font-display text-5xl leading-[1.02] font-bold tracking-tight text-balance xl:text-6xl">
            Ask any video. <span className="text-brand">Jump straight</span> to the answer.
          </h2>
          <DemoCard />
          <ul className="space-y-2.5">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex size-7 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/40">Built for long-form learning: lectures, talks and deep dives.</p>
      </div>
    </aside>
  )
}

/** Phones and tablets: a slim strip of screens and the tagline above the form. */
export function AuthShowcaseStrip() {
  return (
    <div className="relative overflow-hidden px-5 pt-2 pb-6 sm:px-8 lg:hidden">
      <div aria-hidden className="no-scrollbar -mx-5 flex gap-3 overflow-hidden px-5 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]" style={{ perspective: 800 }}>
        {COLUMNS.flat()
          .slice(0, 6)
          .map((id) => (
            <Poster key={id} seed={id} title={TITLES[id] ?? ''} showTitle={false} className="aspect-video w-32 shrink-0 rounded-lg [transform:rotateY(-12deg)] sm:w-40" />
          ))}
      </div>
      <p className="mt-4 font-display text-lg leading-tight font-semibold tracking-tight text-balance sm:text-xl">
        Ask any video. <span className="text-brand">Jump straight</span> to the answer.
      </p>
    </div>
  )
}
