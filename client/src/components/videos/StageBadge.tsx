import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { type StageInput, STAGE_STYLE, stageLabel, videoStage } from './stage'

export default function StageBadge({ video, className }: { video: StageInput; className?: string }) {
  const stage = videoStage(video)
  return (
    <Badge className={cn('gap-1.5 border-transparent', STAGE_STYLE[stage], className)}>
      {(stage === 'uploading' || stage === 'checking' || stage === 'transcoding') && <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden />}
      {stageLabel(video)}
    </Badge>
  )
}
