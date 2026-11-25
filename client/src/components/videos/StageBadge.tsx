import type { OwnVideoDTO } from '@reelstack/shared'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { STAGE_LABEL, STAGE_STYLE, videoStage } from './stage'

export default function StageBadge({ video, className }: { video: Pick<OwnVideoDTO, 'status' | 'processedAt' | 'removedAt'>; className?: string }) {
  const stage = videoStage(video)
  return (
    <Badge className={cn('gap-1.5 border-transparent', STAGE_STYLE[stage], className)}>
      {(stage === 'uploading' || stage === 'checking') && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
      {STAGE_LABEL[stage]}
    </Badge>
  )
}
