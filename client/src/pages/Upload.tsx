import { VISIBILITIES, type Visibility } from '@reelstack/shared'
import { FileVideoIcon, UploadCloudIcon, XIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { type DragEvent, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const MAX_BYTES = 5 * 1024 ** 3

const formatBytes = (n: number) =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${(n / 1024 ** 2).toFixed(1)} MB`

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

export default function Upload() {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')

  // Preview only: Phase 2 replaces this with real chunked upload progress.
  useEffect(() => {
    if (!file) return
    const timer = setInterval(() => setProgress((p) => (p >= 100 ? 100 : p + 4)), 120)
    return () => clearInterval(timer)
  }, [file])

  function pick(f: File | undefined) {
    setError(null)
    if (!f) return
    if (!f.type.startsWith('video/')) return setError('That is not a video file.')
    if (f.size > MAX_BYTES) return setError('Videos can be up to 5 GB.')
    setProgress(0)
    setFile(f)
    setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    pick(e.dataTransfer.files[0])
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-tight">Upload a video</h1>
        <p className="mt-2 text-muted-foreground">Long-form works best: tutorials, talks, lectures. We'll transcribe it so people can ask it questions.</p>
      </div>

      {!file ? (
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
            <p className="mt-1 text-xs text-white/60 sm:text-sm">or click to browse · MP4, MOV, MKV · up to 5 GB</p>
          </ScreenDropZone>
          <input ref={input} type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      ) : (
        <div className="glass space-y-6 rounded-3xl p-6">
          <div className="flex items-center gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-link">
              <FileVideoIcon />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatBytes(file.size)} · {progress < 100 ? `Uploading… ${progress}%` : 'Uploaded (preview)'}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full bg-brand" animate={{ width: `${progress}%` }} />
              </div>
            </div>
            <Button variant="ghost" size="icon" aria-label="Remove file" onClick={() => setFile(null)}>
              <XIcon />
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Visibility</legend>
            <div className="flex flex-wrap gap-2">
              {VISIBILITIES.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={visibility === v}
                  onClick={() => setVisibility(v)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm capitalize transition-colors',
                    visibility === v ? 'border-primary bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center justify-between gap-4 border-t border-glass-border pt-4">
            <p className="text-xs text-muted-foreground">Publishing goes live with the upload pipeline (Phase 2).</p>
            <Button disabled className="rounded-full">
              Publish
            </Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-center text-sm text-destructive-foreground">{error}</p>}
    </div>
  )
}
