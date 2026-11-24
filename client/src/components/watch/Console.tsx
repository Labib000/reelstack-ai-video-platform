import type { TranscriptSegment, VideoDetailDTO } from '@reelstack/shared'
import { ListOrderedIcon, ScrollTextIcon, SparklesIcon } from 'lucide-react'
import { motion } from 'motion/react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import AskPanel from './AskPanel'
import ChaptersPanel from './ChaptersPanel'
import TranscriptPanel from './TranscriptPanel'

export type ConsoleTab = 'ask' | 'chapters' | 'transcript'

const TABS: { value: ConsoleTab; label: string; icon: typeof SparklesIcon }[] = [
  { value: 'ask', label: 'Ask this video', icon: SparklesIcon },
  { value: 'chapters', label: 'Chapters', icon: ListOrderedIcon },
  { value: 'transcript', label: 'Transcript', icon: ScrollTextIcon },
]

/** The glass console beside the theater screen. */
export default function Console({
  video,
  transcript,
  suggestions,
  time,
  tab,
  onTabChange,
  onSeek,
}: {
  video: VideoDetailDTO
  transcript: TranscriptSegment[] | null
  suggestions: string[]
  time: number
  tab: ConsoleTab
  onTabChange: (tab: ConsoleTab) => void
  onSeek: (seconds: number) => void
}) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as ConsoleTab)} className="glass h-full gap-0 overflow-hidden rounded-2xl shadow-xl">
      <TabsList className="no-scrollbar h-12 w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-glass-border bg-transparent px-2">
        {TABS.map(({ value, label, icon: Icon }) => (
          <TabsTrigger
            key={value}
            value={value}
            className="relative h-9 flex-none rounded-lg px-3 data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent"
          >
            <Icon className={value === 'ask' ? 'text-brand' : ''} />
            {label}
            {tab === value && <motion.span layoutId="console-tab" className="absolute inset-x-2 -bottom-[7px] h-0.5 rounded-full bg-brand" />}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="ask" className="min-h-0">
        <AskPanel key={video.id} videoId={video.id} suggestions={suggestions} onSeek={onSeek} />
      </TabsContent>
      <TabsContent value="chapters" className="min-h-0">
        <ChaptersPanel chapters={video.chapters} time={time} onSeek={onSeek} />
      </TabsContent>
      <TabsContent value="transcript" className="min-h-0">
        <TranscriptPanel segments={transcript} time={time} onSeek={onSeek} />
      </TabsContent>
    </Tabs>
  )
}
