/**
 * Chunked, direct-to-storage upload engine. No React: the page feeds it a
 * file and an upload session and renders the progress it reports.
 *
 * - parts go up 4 at a time, each straight to storage via a presigned URL
 * - URLs are fetched in batches of 20 as the upload reaches them
 * - a failed part is retried (fresh URL, backoff) before the upload gives up
 */

export interface PartPlan {
  partNumber: number
  start: number
  end: number
}

/** Byte ranges for each part; the last one may be shorter. */
export function planParts(size: number, partSize: number): PartPlan[] {
  const parts: PartPlan[] = []
  for (let start = 0, n = 1; start < size; start += partSize, n++) parts.push({ partNumber: n, start, end: Math.min(start + partSize, size) })
  return parts
}

export interface UploadProgress {
  loaded: number
  total: number
  /** Bytes per second, smoothed. */
  speed: number
  /** Seconds left at the current speed (null until there's a speed). */
  eta: number | null
}

/** PUTs one part and resolves its ETag. */
export type PutPart = (url: string, body: Blob, onProgress: (loaded: number) => void, signal: AbortSignal) => Promise<string>

export interface UploadOptions {
  file: Blob
  partSize: number
  signParts: (partNumbers: number[]) => Promise<{ partNumber: number; url: string }[]>
  complete: (parts: { partNumber: number; etag: string }[]) => Promise<unknown>
  onProgress?: (p: UploadProgress) => void
  signal?: AbortSignal
  put?: PutPart
  concurrency?: number
  /** Tries per part, including the first. */
  attempts?: number
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export class UploadAbortedError extends Error {
  constructor() {
    super('Upload cancelled')
    this.name = 'AbortError'
  }
}

const BATCH = 20

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** XHR rather than fetch: only XHR reports upload progress. */
export const xhrPut: PutPart = (url, body, onProgress, signal) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.upload.onprogress = (e) => onProgress(e.loaded)
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`Storage answered ${xhr.status}`))
      const etag = xhr.getResponseHeader('ETag')
      // A missing ETag almost always means the bucket's CORS doesn't expose it.
      if (!etag) return reject(new Error('Storage did not return an ETag (check the bucket CORS ExposeHeaders)'))
      resolve(etag)
    }
    xhr.onerror = () => reject(new Error('Network error while uploading'))
    xhr.onabort = () => reject(new UploadAbortedError())
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(body)
  })

export async function uploadFile(opts: UploadOptions): Promise<void> {
  const { file, partSize, put = xhrPut, concurrency = 4, attempts = 3, sleep = defaultSleep, now = () => performance.now() } = opts
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (opts.signal?.aborted) throw new UploadAbortedError()
  opts.signal?.addEventListener('abort', abort, { once: true })
  const { signal } = controller

  const parts = planParts(file.size, partSize)
  const loadedByPart = new Map<number, number>()
  const etags = new Map<number, string>()

  // Progress: total bytes in flight + done, with an exponentially smoothed speed.
  let speed = 0
  let lastT = now()
  let lastLoaded = 0
  const report = () => {
    let loaded = 0
    for (const n of loadedByPart.values()) loaded += n
    const t = now()
    const dt = (t - lastT) / 1000
    if (dt >= 0.5) {
      const instant = Math.max(0, loaded - lastLoaded) / dt
      speed = speed ? speed * 0.7 + instant * 0.3 : instant
      lastT = t
      lastLoaded = loaded
    }
    opts.onProgress?.({ loaded, total: file.size, speed, eta: speed > 0 ? (file.size - loaded) / speed : null })
  }

  // Presigned URLs, fetched one batch at a time (shared between workers).
  const batches = new Map<number, Promise<Map<number, string>>>()
  const urlFor = async (partNumber: number, fresh: boolean) => {
    if (fresh) return (await opts.signParts([partNumber]))[0]!.url
    const b = Math.floor((partNumber - 1) / BATCH)
    let batch = batches.get(b)
    if (!batch) {
      const numbers = parts.slice(b * BATCH, b * BATCH + BATCH).map((p) => p.partNumber)
      batch = opts.signParts(numbers).then((signed) => new Map(signed.map((s) => [s.partNumber, s.url])))
      batches.set(b, batch)
      batch.catch(() => batches.delete(b)) // let a later retry try again
    }
    return (await batch).get(partNumber)!
  }

  const sendPart = async (part: PartPlan) => {
    const body = file.slice(part.start, part.end)
    for (let attempt = 1; ; attempt++) {
      if (signal.aborted) throw new UploadAbortedError()
      try {
        const url = await urlFor(part.partNumber, attempt > 1)
        const etag = await put(url, body, (n) => {
          loadedByPart.set(part.partNumber, n)
          report()
        }, signal)
        loadedByPart.set(part.partNumber, part.end - part.start)
        report()
        etags.set(part.partNumber, etag)
        return
      } catch (error) {
        if (signal.aborted || error instanceof UploadAbortedError) throw new UploadAbortedError()
        loadedByPart.set(part.partNumber, 0)
        if (attempt >= attempts) throw error
        await sleep(1000 * 2 ** (attempt - 1))
      }
    }
  }

  // A small pool: each worker takes the next part until none are left.
  let next = 0
  const worker = async () => {
    while (next < parts.length) await sendPart(parts[next++]!)
  }
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, parts.length) }, worker))
  } catch (error) {
    controller.abort() // stop the other workers' parts too
    throw error
  } finally {
    opts.signal?.removeEventListener('abort', abort)
  }
  await opts.complete(parts.map((p) => ({ partNumber: p.partNumber, etag: etags.get(p.partNumber)! })))
}
