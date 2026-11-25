import type { OwnVideoDTO } from '@reelstack/shared'

export type VideoStage = 'uploading' | 'checking' | 'queued' | 'transcoding' | 'ready' | 'failed' | 'removed'
export type StageInput = Pick<OwnVideoDTO, 'status' | 'processedAt' | 'removedAt' | 'transcodeProgress'>

/**
 * Where a video is in the pipeline, in the user's terms. "processing" covers
 * three steps: the file check (ffprobe), waiting for a transcoder, transcoding.
 */
export function videoStage(v: StageInput): VideoStage {
  if (v.removedAt) return 'removed'
  if (v.status !== 'processing') return v.status
  if (!v.processedAt) return 'checking'
  return v.transcodeProgress === null ? 'queued' : 'transcoding'
}

const LABEL: Record<VideoStage, string> = {
  uploading: 'Uploading',
  checking: 'Checking file',
  queued: 'Waiting to transcode',
  transcoding: 'Transcoding',
  ready: 'Ready',
  failed: 'Failed',
  removed: 'Removed',
}

/** "Transcoding 43%" */
export function stageLabel(v: StageInput): string {
  const stage = videoStage(v)
  return stage === 'transcoding' ? `${LABEL.transcoding} ${v.transcodeProgress}%` : LABEL[stage]
}

export const STAGE_STYLE: Record<VideoStage, string> = {
  uploading: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  checking: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  queued: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  transcoding: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  ready: 'bg-green-500/15 text-green-600 dark:text-green-400',
  failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
  removed: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
}

/** Still moving through the pipeline: worth polling. */
export const isActive = (v: StageInput) => ['uploading', 'checking', 'queued', 'transcoding'].includes(videoStage(v))
