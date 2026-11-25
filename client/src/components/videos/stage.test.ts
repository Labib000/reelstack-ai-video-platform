import { describe, expect, it } from 'vitest'

import { isUploadId } from '@/lib/videoId'

import { isActive, stageLabel, videoStage } from './stage'

const base = { status: 'processing' as const, processedAt: null, removedAt: null, transcodeProgress: null }
const checked = { ...base, processedAt: '2026-11-25T10:00:00Z' }

describe('videoStage', () => {
  it('splits "processing" into its real steps', () => {
    expect(videoStage(base)).toBe('checking')
    expect(videoStage(checked)).toBe('queued')
    expect(stageLabel({ ...checked, transcodeProgress: 0 })).toBe('Transcoding 0%')
    expect(videoStage({ ...checked, status: 'ready' })).toBe('ready')
    expect(videoStage({ ...checked, removedAt: 'x' })).toBe('removed')
  })
  it('polls until ready or failed', () => {
    expect([base, checked, { ...checked, transcodeProgress: 40 }].every(isActive)).toBe(true)
    expect(isActive({ ...checked, status: 'ready' })).toBe(false)
    expect(isActive({ ...checked, status: 'failed' })).toBe(false)
  })
})

describe('isUploadId', () => {
  it('tells real uploads from catalogue ids', () => {
    expect(isUploadId('6b05987e27f379bcf4ea0af4')).toBe(true)
    expect(isUploadId('jwt-rotation')).toBe(false)
  })
})
