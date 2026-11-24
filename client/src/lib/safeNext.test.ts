import { describe, expect, it } from 'vitest'

import { safeNext } from './safeNext.ts'

describe('safeNext', () => {
  it('keeps same-site paths with query and hash', () => {
    expect(safeNext('/upload?x=1#top')).toBe('/upload?x=1#top')
  })

  it.each([null, '', 'upload', '//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)'])(
    'falls back for %s',
    (next) => {
      expect(safeNext(next)).toBe('/')
    },
  )
})
