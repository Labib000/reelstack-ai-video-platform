import type { OwnVideoDTO } from '@reelstack/shared'

export type VideoStage = 'uploading' | 'checking' | 'queued' | 'ready' | 'failed' | 'removed'

/**
 * Where a video is in the pipeline, in the user's terms. "processing" covers
 * two steps: the file check (ffprobe), then waiting for the transcoder.
 */
export function videoStage(v: Pick<OwnVideoDTO, 'status' | 'processedAt' | 'removedAt'>): VideoStage {
  if (v.removedAt) return 'removed'
  if (v.status === 'processing') return v.processedAt ? 'queued' : 'checking'
  return v.status
}

export const STAGE_LABEL: Record<VideoStage, string> = {
  uploading: 'Uploading',
  checking: 'Checking file',
  queued: 'Waiting to transcode',
  ready: 'Ready',
  failed: 'Failed',
  removed: 'Removed',
}

export const STAGE_STYLE: Record<VideoStage, string> = {
  uploading: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  checking: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  queued: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  ready: 'bg-green-500/15 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
  removed: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
}

/** Still moving through the pipeline: worth polling. */
export const isActive = (v: Pick<OwnVideoDTO, 'status' | 'processedAt' | 'removedAt'>) => {
  const s = videoStage(v)
  return s === 'uploading' || s === 'checking'
}
