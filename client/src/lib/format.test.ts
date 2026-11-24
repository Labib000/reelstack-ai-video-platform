import { describe, expect, it } from 'vitest'

import { formatDuration, formatViews, hashString } from './format'

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(75)).toBe('1:15')
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('formats view counts', () => {
    expect(formatViews(1)).toBe('1 view')
    expect(formatViews(12_345)).toBe('12.3K views')
  })

  it('hashes stably', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
  })
})
