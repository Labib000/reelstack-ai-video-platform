import type { WatchVideoDTO } from '@reelstack/shared'
import type Hls from 'hls.js'
import { MaximizeIcon, MinimizeIcon, PauseIcon, PlayIcon, RotateCcwIcon, SettingsIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

import { posterBackground } from '@/components/media/poster-palette'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Spinner } from '@/components/ui/spinner'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Don't loop asking for new links if the new one fails too. */
const RENEW_EVERY_MS = 30_000
const HIDE_AFTER_MS = 2500

/**
 * Adaptive HLS player: hls.js where it's supported, the browser's own HLS
 * otherwise (iOS Safari). When the link expires it asks for a new one through
 * `onExpired` and carries on from the same second.
 */
export default function HlsPlayer({
  video,
  startAt = 0,
  onTime,
  onExpired,
  renewError,
}: {
  video: WatchVideoDTO
  startAt?: number
  onTime?: (sec: number) => void
  onExpired: () => void
  /** Why asking for a new link failed. */
  renewError?: string | null
}) {
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const el = useRef<HTMLVideoElement>(null)
  const hls = useRef<Hls | null>(null)
  const [initial] = useState(() => Math.min(Math.max(0, startAt), Math.max(0, video.durationSec - 1)))
  const resume = useRef({ at: initial, play: false })
  const renewedAt = useRef(-Infinity)
  const expired = useRef(onExpired)
  useEffect(() => {
    expired.current = onExpired
  })

  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [time, setTime] = useState(initial)
  const [buffered, setBuffered] = useState(0)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [full, setFull] = useState(false)
  const [idle, setIdle] = useState(false)
  const [problem, setError] = useState<string | null>(null)
  const error = problem ?? renewError ?? null
  const [levels, setLevels] = useState<{ index: number; name: number }[]>([])
  const [quality, setQuality] = useState('auto')
  const [current, setCurrent] = useState<number | null>(null)

  const src = video.playbackUrl
  useEffect(() => {
    const media = el.current!
    let gone = false
    let engine: Hls | null = null
    let recovered = false

    const renew = (message: string) => {
      const now = performance.now()
      if (now - renewedAt.current < RENEW_EVERY_MS) return setError(message)
      renewedAt.current = now
      resume.current = { at: media.currentTime || resume.current.at, play: !media.paused }
      setWaiting(true)
      expired.current()
    }
    const onMeta = () => {
      if (resume.current.at > 0 && Math.abs(media.currentTime - resume.current.at) > 1) media.currentTime = resume.current.at
      if (resume.current.play) void media.play().catch(() => {})
    }
    const onNativeError = () => renew('This video couldn’t be loaded.')
    media.addEventListener('loadedmetadata', onMeta)

    void import('hls.js')
      .then(({ default: HlsLib }) => {
        if (gone) return
        if (!HlsLib.isSupported()) {
          if (!media.canPlayType('application/vnd.apple.mpegurl')) return setError('Your browser can’t play this video.')
          media.addEventListener('error', onNativeError)
          media.src = src
          return
        }
        engine = new HlsLib({ startPosition: resume.current.at || -1, capLevelToPlayerSize: true, maxBufferLength: 30, maxMaxBufferLength: 60 })
        hls.current = engine
        const shortSide = (l: { width: number; height: number }) => Math.min(l.width, l.height)
        engine.on(HlsLib.Events.MANIFEST_PARSED, (_e, d) => {
          setError(null)
          setWaiting(false)
          setQuality('auto')
          setLevels(d.levels.map((l, index) => ({ index, name: shortSide(l) })))
        })
        engine.on(HlsLib.Events.LEVEL_SWITCHED, (_e, d) => setCurrent(engine?.levels[d.level] ? shortSide(engine.levels[d.level]!) : null))
        engine.on(HlsLib.Events.ERROR, (_e, d) => {
          const code = d.response?.code
          // An expired link is a 403 (storage) or 404 (API): retrying it can't help.
          if (code === 403 || code === 404) return renew('This video isn’t available any more.')
          if (!d.fatal) return
          if (d.type === HlsLib.ErrorTypes.MEDIA_ERROR && !recovered) {
            recovered = true
            engine?.recoverMediaError()
          } else if (d.type === HlsLib.ErrorTypes.NETWORK_ERROR) setError('The connection dropped.')
          else setError('This video couldn’t be played.')
        })
        engine.loadSource(src)
        engine.attachMedia(media)
      })
      .catch(() => !gone && setError('The player couldn’t be loaded.'))

    return () => {
      gone = true
      media.removeEventListener('loadedmetadata', onMeta)
      media.removeEventListener('error', onNativeError)
      engine?.destroy()
      hls.current = null
    }
  }, [src])

  useEffect(() => {
    const onFull = () => setFull(box !== null && document.fullscreenElement === box)
    document.addEventListener('fullscreenchange', onFull)
    return () => document.removeEventListener('fullscreenchange', onFull)
  }, [box])

  // Fade the controls out while playing and untouched.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wake = () => {
    setIdle(false)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setIdle(true), HIDE_AFTER_MS)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const toggle = () => {
    const m = el.current!
    if (m.paused) void m.play().catch(() => {})
    else m.pause()
    wake()
  }
  const seek = (sec: number) => {
    const m = el.current!
    m.currentTime = Math.min(video.durationSec, Math.max(0, sec))
    setTime(m.currentTime)
    wake()
  }
  const fullscreen = () => {
    const m = el.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void }
    if (document.fullscreenElement) void document.exitFullscreen()
    else if (box?.requestFullscreen) void box.requestFullscreen().catch(() => {})
    else m.webkitEnterFullscreen?.() // iPhone
  }
  const pickQuality = (value: string) => {
    setQuality(value)
    // Switch what's being watched now, not only what's buffered next.
    if (hls.current) hls.current.currentLevel = value === 'auto' ? -1 : Number(value)
  }
  const onKey = (e: KeyboardEvent) => {
    // Buttons, sliders and menus keep their own keys.
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return
    const keys: Record<string, () => void> = {
      ' ': toggle,
      k: toggle,
      ArrowLeft: () => seek(time - 5),
      ArrowRight: () => seek(time + 5),
      j: () => seek(time - 10),
      l: () => seek(time + 10),
      m: () => (el.current!.muted = !el.current!.muted),
      f: fullscreen,
    }
    if (!keys[e.key]) return
    e.preventDefault()
    keys[e.key]!()
  }
  const retry = () => {
    setError(null)
    renewedAt.current = performance.now()
    resume.current = { at: el.current?.currentTime || resume.current.at, play: true }
    onExpired()
  }

  const pct = (s: number) => `${Math.min(100, (s / video.durationSec) * 100)}%`
  const hidden = playing && idle
  const icon = 'size-9 text-white hover:bg-white/15 hover:text-white'

  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] opacity-30 blur-3xl saturate-150 sm:-inset-8" style={{ background: posterBackground(video.id) }} />
      <div
        ref={setBox}
        role="region"
        aria-label="Video player"
        tabIndex={0}
        onKeyDown={onKey}
        onPointerMove={wake}
        className={cn('relative aspect-video overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 outline-none focus-visible:ring-2 focus-visible:ring-ring', hidden && 'cursor-none')}
      >
        <video
          ref={el}
          playsInline
          poster={video.thumbnailUrl ?? undefined}
          className="size-full object-contain"
          onClick={toggle}
          onPlay={() => {
            setPlaying(true)
            setStarted(true)
            wake()
          }}
          onPause={() => setPlaying(false)}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onCanPlay={() => setWaiting(false)}
          onTimeUpdate={(e) => {
            setTime(e.currentTarget.currentTime)
            onTime?.(e.currentTarget.currentTime)
          }}
          onProgress={(e) => {
            const b = e.currentTarget.buffered
            setBuffered(b.length ? b.end(b.length - 1) : 0)
          }}
          onVolumeChange={(e) => {
            setMuted(e.currentTarget.muted)
            setVolume(e.currentTarget.volume)
          }}
        />

        {waiting && !error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <Spinner className="size-10 text-white" />
          </div>
        )}
        {!started && !waiting && !error && (
          <button type="button" aria-label="Play" onClick={toggle} className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/90 text-white shadow-2xl shadow-primary/40 sm:size-20">
              <PlayIcon className="ml-1 size-7 fill-current sm:size-8" />
            </span>
          </button>
        )}
        {error && (
          <div role="alert" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center text-white">
            <p className="font-medium">{error}</p>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={retry}>
              <RotateCcwIcon /> Try again
            </Button>
          </div>
        )}

        <div
          className={cn(
            'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pt-10 pb-1.5 text-white transition-opacity focus-within:opacity-100 sm:px-3 sm:pb-2',
            hidden && 'pointer-events-none opacity-0',
          )}
        >
          <div className="relative flex h-4 items-center px-1">
            <div className="pointer-events-none absolute inset-x-1 h-1.5 overflow-hidden rounded-full bg-white/25">
              <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: pct(buffered) }} />
              <div className="absolute inset-y-0 left-0 bg-brand" style={{ width: pct(time) }} />
            </div>
            <input
              type="range"
              aria-label="Seek"
              aria-valuetext={formatDuration(Math.floor(time))}
              min={0}
              max={video.durationSec}
              step={1}
              value={Math.floor(time)}
              onChange={(e) => seek(Number(e.target.value))}
              className="relative h-4 w-full cursor-pointer appearance-none bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-white [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className={icon} aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>
              {playing ? <PauseIcon className="fill-current" /> : <PlayIcon className="fill-current" />}
            </Button>
            <Button variant="ghost" size="icon" className={icon} aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => (el.current!.muted = !muted)}>
              {muted || volume === 0 ? <VolumeXIcon /> : <Volume2Icon />}
            </Button>
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                el.current!.volume = Number(e.target.value)
                el.current!.muted = false
              }}
              className="hidden w-20 cursor-pointer accent-white sm:block"
            />
            <span className="ml-2 font-mono text-xs whitespace-nowrap tabular-nums">
              {formatDuration(Math.floor(time))} / {formatDuration(video.durationSec)}
            </span>
            <div className="ml-auto flex items-center gap-0.5">
              {levels.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2 text-xs text-white hover:bg-white/15 hover:text-white" aria-label="Quality">
                      <SettingsIcon /> {quality === 'auto' ? `Auto${current ? ` ${current}p` : ''}` : `${levels.find((l) => String(l.index) === quality)?.name}p`}
                    </Button>
                  </DropdownMenuTrigger>
                  {/* Inside the player, so it's still there in fullscreen. */}
                  <DropdownMenuContent align="end" side="top" container={box}>
                    <DropdownMenuRadioGroup value={quality} onValueChange={pickQuality}>
                      <DropdownMenuRadioItem value="auto">Auto</DropdownMenuRadioItem>
                      {[...levels].reverse().map((l) => (
                        <DropdownMenuRadioItem key={l.index} value={String(l.index)}>
                          {l.name}p
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button variant="ghost" size="icon" className={icon} aria-label={full ? 'Exit full screen' : 'Full screen'} onClick={fullscreen}>
                {full ? <MinimizeIcon /> : <MaximizeIcon />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
