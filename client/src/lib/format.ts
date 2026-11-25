/** 75 -> "1:15", 3725 -> "1:02:05". */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** 12_345 -> "12.3K views". */
export const formatViews = (n: number) => `${compact.format(n)} view${n === 1 ? '' : 's'}`

/** Stable small integer from a string, for picking poster palettes. */
export function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 1.2 GB / 340.5 MB / 12 KB */
export function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}

/** "2 min left" / "45 s left" */
export function formatEta(sec: number): string {
  if (sec >= 3600) return `${Math.floor(sec / 3600)} h ${Math.round((sec % 3600) / 60)} min left`
  if (sec >= 60) return `${Math.round(sec / 60)} min left`
  return `${Math.max(1, Math.round(sec))} s left`
}
