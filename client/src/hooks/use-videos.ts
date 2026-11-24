import type { VideoSummaryDTO } from '@reelstack/shared'
import { useEffect, useState } from 'react'

import { getVideosByIds } from '@/data'

/** Loads summaries for a list of ids (History, Watch later, Liked), keeping their order. */
export function useVideos(ids: string[]): VideoSummaryDTO[] | null {
  const key = ids.join(',')
  const [result, setResult] = useState<{ key: string; videos: VideoSummaryDTO[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    void getVideosByIds(key ? key.split(',') : []).then((videos) => !cancelled && setResult({ key, videos }))
    return () => {
      cancelled = true
    }
  }, [key])

  if (!result) return null
  // Removing an item shouldn't flash a skeleton: filter the last result.
  if (result.key !== key) {
    const wanted = new Set(ids)
    return result.videos.filter((v) => wanted.has(v.id))
  }
  return result.videos
}
