import { describe, expect, it, vi } from 'vitest'

import { type PutPart, UploadAbortedError, planParts, uploadFile } from './upload'

const sign = vi.fn(async (nums: number[]) => nums.map((partNumber) => ({ partNumber, url: `u${partNumber}` })))
const noSleep = async () => {}

describe('planParts', () => {
  it('splits into fixed parts with a shorter last one', () => {
    expect(planParts(25, 10)).toEqual([
      { partNumber: 1, start: 0, end: 10 },
      { partNumber: 2, start: 10, end: 20 },
      { partNumber: 3, start: 20, end: 25 },
    ])
    expect(planParts(20, 10)).toHaveLength(2)
  })
})

describe('uploadFile', () => {
  it('uploads every part and completes with the ETags in order', async () => {
    const put: PutPart = async (url, body, onProgress) => {
      onProgress(body.size)
      return `"${url}"`
    }
    const complete = vi.fn(async () => {})
    const progress: number[] = []
    await uploadFile({ file: new Blob(['x'.repeat(45)]), partSize: 10, signParts: sign, complete, put, sleep: noSleep, onProgress: (p) => progress.push(p.loaded) })
    expect(complete).toHaveBeenCalledWith([1, 2, 3, 4, 5].map((n) => ({ partNumber: n, etag: `"u${n}"` })))
    expect(progress.at(-1)).toBe(45)
  })

  it('signs URLs in batches of 20', async () => {
    const signParts = vi.fn(sign)
    await uploadFile({ file: new Blob(['x'.repeat(45)]), partSize: 1, signParts, complete: async () => {}, put: async () => 'e', sleep: noSleep })
    expect(signParts.mock.calls.map((c) => c[0].length)).toEqual([20, 20, 5])
  })

  it('retries a failing part with a fresh URL and then succeeds', async () => {
    let fails = 2
    const put: PutPart = async (url) => {
      if (url === 'u2' && fails-- > 0) throw new Error('flaky')
      return 'e'
    }
    const signParts = vi.fn(sign)
    const sleep = vi.fn(noSleep)
    await uploadFile({ file: new Blob(['x'.repeat(30)]), partSize: 10, signParts, complete: async () => {}, put, sleep })
    expect(sleep).toHaveBeenCalledTimes(2)
    expect(signParts).toHaveBeenCalledWith([2])
  })

  it('gives up after the last attempt', async () => {
    const put: PutPart = async () => {
      throw new Error('down')
    }
    const complete = vi.fn()
    await expect(uploadFile({ file: new Blob(['x'.repeat(10)]), partSize: 10, signParts: sign, complete, put, sleep: noSleep })).rejects.toThrow('down')
    expect(complete).not.toHaveBeenCalled()
  })

  it('stops starting parts once cancelled', async () => {
    const controller = new AbortController()
    const started: string[] = []
    const put: PutPart = async (url) => {
      started.push(url)
      if (url === 'u1') controller.abort()
      return 'e'
    }
    await expect(
      uploadFile({ file: new Blob(['x'.repeat(50)]), partSize: 10, concurrency: 1, signParts: sign, complete: async () => {}, put, sleep: noSleep, signal: controller.signal }),
    ).rejects.toBeInstanceOf(UploadAbortedError)
    expect(started).toEqual(['u1'])
  })
})
