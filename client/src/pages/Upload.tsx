import { type OwnVideoDTO, UPLOAD_LIMITS, type Visibility } from '@reelstack/shared'
import { CheckIcon, ClockIcon, FileVideoIcon, RotateCcwIcon, UploadCloudIcon, XIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { type DragEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { apiError } from '@/api/http'
import { cancelUpload, completeUpload, getVideo, signParts, startUpload, updateVideo } from '@/api/videos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import StageBadge from '@/components/videos/StageBadge'
import VisibilityPicker from '@/components/videos/VisibilityPicker'
import { isActive, videoStage } from '@/components/videos/stage'
import { formatBytes, formatDuration, formatEta } from '@/lib/format'
import { UploadAbortedError, type UploadProgress, uploadFile } from '@/lib/upload'
import { cn } from '@/lib/utils'

/** Some browsers leave `file.type` empty for MKV and friends. */
const TYPE_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
}
function videoType(f: File): string | null {
  if (f.type.startsWith('video/')) return f.type
  return TYPE_BY_EXT[f.name.split('.').pop()?.toLowerCase() ?? ''] ?? null
}
const titleFrom = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 120) || 'Untitled video'

type Phase =
  | { kind: 'idle' }
  | { kind: 'starting'; file: File }
  | { kind: 'uploading'; file: File; video: OwnVideoDTO; progress: UploadProgress }
  | { kind: 'done'; file: File; video: OwnVideoDTO }
  | { kind: 'error'; file: File; message: string }

/**
 * The drop zone is the ReelStack mark at full size: a tilted red frame
 * around a dark screen. Drop a video "on the screen".
 */
function ScreenDropZone({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <motion.div animate={{ scale: active ? 1.02 : 1 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="relative mx-auto aspect-[335/291] w-full max-w-xl">
      <svg viewBox="0 0 335 291" preserveAspectRatio="none" className={cn('absolute inset-0 size-full transition-[filter]', active && 'drop-shadow-[0_0_30px_var(--brand)]')} aria-hidden>
        <defs>
          <linearGradient id="upload-frame" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8232b" />
            <stop offset="1" stopColor="#e01626" />
          </linearGradient>
        </defs>
        <path fill="url(#upload-frame)" d="M55 1 L296 46 Q334 53 334 92 L334 200 Q334 238 296 245 L55 289 Q1 299 1 240 L1 52 Q1 -8 55 1 Z" />
        <path fill="#121111" d="M70 49 L287 79 Q299 81 299 93 L299 203 Q299 215 287 217 L70 242 Q55 244 55 229 L55 63 Q55 47 70 49 Z" />
      </svg>
      <div className="absolute inset-[18%_14%_18%_18%] flex flex-col items-center justify-center text-center text-white">{children}</div>
    </motion.div>
  )
}

/** Upload → check → transcode → ready, with the current step lit. */
function Pipeline({ video, uploading }: { video: OwnVideoDTO | null; uploading: boolean }) {
  const stage = video ? videoStage(video) : 'uploading'
  const steps = [
    { label: 'Upload', done: !uploading && stage !== 'uploading', active: uploading || stage === 'uploading' },
    { label: 'Check file', done: stage === 'queued' || stage === 'ready', active: stage === 'checking' },
    { label: 'Transcode', done: stage === 'ready', active: stage === 'queued', note: 'coming in the next phase' },
    { label: 'Ready to watch', done: stage === 'ready', active: false },
  ]
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Processing steps">
      {steps.map((s, i) => (
        <li key={s.label} className="min-w-0">
          <div className={cn('h-1 rounded-full', s.done ? 'bg-brand' : s.active ? 'bg-brand/40' : 'bg-muted')} />
          <p className={cn('mt-2 flex items-center gap-1 truncate text-xs font-medium', s.done || s.active ? 'text-foreground' : 'text-muted-foreground')}>
            {s.done ? <CheckIcon className="size-3.5 text-brand" /> : s.active ? s.note ? <ClockIcon className="size-3.5" /> : <Spinner className="size-3" /> : <span className="tabular-nums">{i + 1}.</span>}
            <span className="truncate">{s.label}</span>
          </p>
          {s.note && s.active && <p className="truncate text-[11px] text-muted-foreground">{s.note}</p>}
        </li>
      ))}
    </ol>
  )
}

export default function Upload() {
  const input = useRef<HTMLInputElement>(null)
  const controller = useRef<AbortController | null>(null)
  const [dragging, setDragging] = useState(false)
  const [pickError, setPickError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const details = useRef({ title, description, visibility, dirty })
  useEffect(() => {
    details.current = { title, description, visibility, dirty }
  })

  const videoId = phase.kind === 'uploading' || phase.kind === 'done' ? phase.video.id : null
  const uploading = phase.kind === 'starting' || phase.kind === 'uploading'

  // Leaving mid-upload: warn on tab close; cancel it if the page unmounts.
  useEffect(() => {
    if (!uploading) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])
  useEffect(() => () => controller.current?.abort(), [])

  // After upload: poll until the file check finishes.
  const doneVideo = phase.kind === 'done' ? phase.video : null
  useEffect(() => {
    if (!doneVideo || !isActive(doneVideo)) return
    const timer = setInterval(async () => {
      try {
        const video = await getVideo(doneVideo.id)
        setPhase((p) => (p.kind === 'done' && p.video.id === video.id ? { ...p, video } : p))
      } catch {
        /* try again next tick */
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [doneVideo])

  async function begin(file: File) {
    const contentType = videoType(file)!
    const ctrl = new AbortController()
    controller.current = ctrl
    setPhase({ kind: 'starting', file })
    let video: OwnVideoDTO | null = null
    try {
      const d = details.current
      const session = await startUpload({ fileName: file.name, sizeBytes: file.size, contentType, title: d.title, description: d.description, visibility: d.visibility })
      video = session.video
      if (ctrl.signal.aborted) throw new UploadAbortedError() // cancelled while preparing
      const zero = { loaded: 0, total: file.size, speed: 0, eta: null }
      setPhase({ kind: 'uploading', file, video: session.video, progress: zero })
      const id = session.video.id
      await uploadFile({
        file,
        partSize: session.partSize,
        signal: ctrl.signal,
        signParts: (nums) => signParts(id, nums),
        complete: async (parts) => {
          let done = await completeUpload(id, parts)
          // Details typed while the file was uploading.
          const latest = details.current
          if (latest.dirty) {
            // The file is safe even if this fails: the form stays unsaved.
            try {
              done = await updateVideo(id, { title: latest.title, description: latest.description, visibility: latest.visibility })
              setDirty(false)
            } catch (e) {
              toast.error('Your video uploaded, but its details weren’t saved', { description: apiError(e).message })
            }
          }
          setPhase({ kind: 'done', file, video: done })
        },
        onProgress: (progress) => setPhase((p) => (p.kind === 'uploading' ? { ...p, progress } : p)),
      })
    } catch (error) {
      if (error instanceof UploadAbortedError || ctrl.signal.aborted) {
        if (video) void cancelUpload(video.id).catch(() => {})
        return
      }
      if (video) void cancelUpload(video.id).catch(() => {})
      const message = apiError(error).message
      setPhase({ kind: 'error', file, message })
      toast.error('Upload failed', { description: message })
    }
  }

  function pick(f: File | undefined) {
    setPickError(null)
    if (!f) return
    if (!videoType(f)) return setPickError('That isn’t a video file. Try MP4, MOV, MKV or WebM.')
    if (f.size === 0) return setPickError('That file is empty.')
    if (f.size > UPLOAD_LIMITS.maxBytes) return setPickError('Videos can be up to 5 GB.')
    setTitle(titleFrom(f.name))
    setDescription('')
    setVisibility('public')
    setDirty(false)
    details.current = { title: titleFrom(f.name), description: '', visibility: 'public', dirty: false }
    void begin(f)
  }

  function cancel() {
    controller.current?.abort()
    setPhase({ kind: 'idle' })
    toast('Upload cancelled')
  }

  function reset() {
    if (input.current) input.current.value = ''
    setPhase({ kind: 'idle' })
  }

  async function saveDetails() {
    if (!videoId) return
    setSaving(true)
    try {
      const video = await updateVideo(videoId, { title, description, visibility })
      setDirty(false)
      setPhase((p) => (p.kind === 'uploading' || p.kind === 'done' ? { ...p, video } : p))
      toast.success('Details saved')
    } catch (e) {
      const info = apiError(e)
      toast.error(info.fieldErrors.title ?? info.message)
    } finally {
      setSaving(false)
    }
  }

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setDirty(true)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files[0])
  }

  if (phase.kind === 'idle') {
    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight">Upload a video</h1>
          <p className="mt-2 text-muted-foreground">Long-form works best: tutorials, talks, lectures. We'll transcribe it so people can ask it questions.</p>
        </div>
        <div
          role="button"
          tabIndex={0}
          aria-label="Choose a video to upload"
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="cursor-pointer rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ScreenDropZone active={dragging}>
            <UploadCloudIcon className="size-10 text-white/80 sm:size-14" />
            <p className="mt-3 font-display text-lg font-semibold sm:text-2xl">{dragging ? 'Let go to drop it' : 'Drop your video on the screen'}</p>
            <p className="mt-1 text-xs text-white/60 sm:text-sm">or click to browse · MP4, MOV, MKV, WebM · up to 5 GB</p>
          </ScreenDropZone>
          <input ref={input} type="file" accept="video/*,.mkv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
        {pickError && (
          <p role="alert" className="text-center text-sm text-destructive-foreground">
            {pickError}
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Up to {UPLOAD_LIMITS.maxInProgress} uploads at once and {UPLOAD_LIMITS.maxPerDay} a day. Files go straight to storage in 10 MB chunks.
        </p>
      </div>
    )
  }

  const { file } = phase
  const progress = phase.kind === 'uploading' ? phase.progress : null
  const pct = phase.kind === 'done' ? 100 : progress ? Math.floor((progress.loaded / progress.total) * 100) : 0
  const video = phase.kind === 'uploading' || phase.kind === 'done' ? phase.video : null
  const failed = phase.kind === 'error' || (phase.kind === 'done' && phase.video.status === 'failed')

  let statusLine: string
  if (phase.kind === 'starting') statusLine = 'Preparing upload…'
  else if (phase.kind === 'uploading')
    statusLine = `${formatBytes(phase.progress.loaded)} of ${formatBytes(file.size)}${phase.progress.speed ? ` · ${formatBytes(phase.progress.speed)}/s` : ''}${phase.progress.eta != null ? ` · ${formatEta(phase.progress.eta)}` : ''}`
  else if (phase.kind === 'error') statusLine = phase.message
  else if (phase.video.status === 'failed') statusLine = phase.video.error ?? 'We couldn’t process this file.'
  else if (videoStage(phase.video) === 'checking') statusLine = 'Uploaded. Checking the file…'
  else
    statusLine = `Uploaded and checked${phase.video.durationSec ? ` · ${formatDuration(phase.video.durationSec)}` : ''}${phase.video.height ? ` · ${phase.video.height}p` : ''}`

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {failed ? 'We couldn’t use that file' : phase.kind === 'done' ? 'Upload complete' : 'Uploading your video'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {failed
            ? phase.kind === 'error'
              ? 'The upload didn’t finish. Nothing was saved, so you can try again.'
              : 'It uploaded, but it isn’t a video we can play. Export it again as MP4 (H.264) and try once more.'
            : uploading
              ? 'Keep this tab open until the upload finishes. You can fill in the details meanwhile.'
              : 'You can edit the details any time from Your videos.'}
        </p>
      </div>

      <section className="glass space-y-5 rounded-3xl p-5 sm:p-6" aria-live="polite">
        <div className="flex items-start gap-4">
          <span className={cn('flex size-12 shrink-0 items-center justify-center rounded-xl', failed ? 'bg-red-500/15 text-red-500' : 'bg-primary/15 text-link')}>
            <FileVideoIcon />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{file.name}</p>
              {video && phase.kind === 'done' && <StageBadge video={video} className="shrink-0" />}
            </div>
            <p className={cn('mt-0.5 text-sm', failed ? 'text-destructive-foreground' : 'text-muted-foreground')}>{statusLine}</p>
            {!failed && (
              <div className="mt-3 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
                  <motion.div className="h-full rounded-full bg-brand" initial={false} animate={{ width: `${pct}%` }} transition={{ ease: 'linear', duration: 0.3 }} />
                </div>
                <span className="w-10 text-right text-sm font-medium tabular-nums">{pct}%</span>
              </div>
            )}
          </div>
          {uploading && (
            <Button variant="ghost" size="icon" aria-label="Cancel upload" onClick={cancel}>
              <XIcon />
            </Button>
          )}
        </div>
        {!failed && <Pipeline video={video} uploading={uploading} />}
        {failed && (
          <div className="flex flex-wrap gap-2">
            {phase.kind === 'error' && (
              <Button onClick={() => void begin(file)} className="rounded-full">
                <RotateCcwIcon /> Try again
              </Button>
            )}
            <Button variant={phase.kind === 'error' ? 'outline' : 'default'} onClick={reset} className="rounded-full">
              Choose another file
            </Button>
            {phase.kind === 'done' && (
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/library#your-videos">Your videos</Link>
              </Button>
            )}
          </div>
        )}
      </section>

      {!failed && (
        <section className="glass space-y-5 rounded-3xl p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold">Details</h2>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => edit(setTitle)(e.target.value)} maxLength={120} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => edit(setDescription)(e.target.value)}
              rows={4}
              maxLength={5000}
              placeholder="What's it about? Chapters and timestamps help people find their way."
            />
          </div>
          <VisibilityPicker value={visibility} onChange={edit(setVisibility)} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-glass-border pt-4">
            <p className="text-xs text-muted-foreground">
              {dirty ? (uploading ? 'Unsaved: saved automatically when the upload finishes.' : 'Unsaved changes') : 'All changes saved'}
            </p>
            <div className="flex gap-2">
              {phase.kind === 'done' && (
                <>
                  <Button variant="outline" className="rounded-full" onClick={reset}>
                    Upload another
                  </Button>
                  <Button asChild variant="outline" className="rounded-full">
                    <Link to="/library#your-videos">Your videos</Link>
                  </Button>
                </>
              )}
              <Button className="rounded-full" onClick={() => void saveDetails()} disabled={!videoId || !dirty || saving || !title.trim()}>
                {saving && <Spinner />} Save
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
