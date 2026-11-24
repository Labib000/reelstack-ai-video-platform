import type { AskAnswer } from '@reelstack/shared'
import { ArrowUpIcon, SparklesIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { askVideo } from '@/data'
import { scrollWithin } from '@/lib/scroll'

import TimeChip from './TimeChip'

type Message = { id: number; role: 'user'; text: string } | { id: number; role: 'answer'; answer: AskAnswer }

/** Conversations per video for this tab, so closing the Ask sheet keeps them. */
const history = new Map<string, Message[]>()

export default function AskPanel({
  videoId,
  suggestions,
  onSeek,
}: {
  videoId: string
  suggestions: string[]
  onSeek: (seconds: number) => void
}) {
  const [messages, setMessages] = useState<Message[]>(() => history.get(videoId) ?? [])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const nextId = useRef(messages.length)

  useEffect(() => {
    history.set(videoId, messages)
  }, [videoId, messages])

  useEffect(() => {
    scrollWithin(list.current, end.current, 'end')
  }, [messages, pending])

  async function ask(question: string) {
    const q = question.trim()
    if (q.length < 3 || pending) return
    setDraft('')
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', text: q }])
    setPending(true)
    try {
      const answer = await askVideo(videoId, q)
      setMessages((m) => [...m, { id: nextId.current++, role: 'answer', answer }])
    } finally {
      setPending(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void ask(draft)
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={list} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="flex flex-col items-center px-2 pt-6 text-center">
            <LogoMark className="h-10" />
            <p className="mt-4 font-display text-lg font-semibold">Ask this video anything</p>
            <p className="mt-1 text-sm text-muted-foreground">Answers come from what's said, with links to the moment.</p>
            <div className="mt-5 flex w-full flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void ask(s)}
                  className="glass rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <SparklesIcon className="mr-2 inline size-3.5 text-brand" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={m.role === 'user' ? 'flex justify-end' : ''}
            >
              {m.role === 'user' ? (
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">{m.text}</p>
              ) : (
                <div className="space-y-2 text-sm leading-relaxed">
                  <p className={m.answer.covered ? '' : 'text-muted-foreground italic'}>{m.answer.answer}</p>
                  {m.answer.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.answer.citations.map((c) => (
                        <TimeChip key={c.start} seconds={c.start} onSeek={onSeek} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {pending && (
          <div className="flex gap-1 py-1" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="size-1.5 rounded-full bg-muted-foreground"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </div>
        )}
        <div ref={end} />
      </div>

      <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-glass-border p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(draft)
            }
          }}
          rows={1}
          maxLength={500}
          placeholder="Ask about this video…"
          aria-label="Ask about this video"
          className="max-h-32 min-h-10 resize-none bg-background/50"
        />
        <Button type="submit" size="icon" disabled={pending || draft.trim().length < 3} aria-label="Send" className="shrink-0 rounded-full">
          <ArrowUpIcon />
        </Button>
      </form>
    </div>
  )
}
