import type { VideoSummaryDTO } from '@reelstack/shared'

import VideoCard, { VideoCardSkeleton } from './VideoCard'

/** Responsive grid of cards (flat, not tilted: grids read better square-on). */
export default function VideoGrid({ videos, skeletons = 8 }: { videos: VideoSummaryDTO[] | null; skeletons?: number }) {
  return (
    <div className="grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos === null ? Array.from({ length: skeletons }, (_, i) => <VideoCardSkeleton key={i} />) : videos.map((v) => <VideoCard key={v.id} video={v} tilt={false} />)}
    </div>
  )
}
