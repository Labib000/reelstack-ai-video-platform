import { CheckIcon } from 'lucide-react'
import { motion } from 'motion/react'

import { cn } from '@/lib/utils'

/**
 * Signup progress. From sm up: numbered steps joined by a filling line
 * (finished steps are clickable to go back). Phones: "Step 2 of 3" + bar.
 */
export default function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: readonly { id: string; title: string }[]
  current: number
  onSelect: (index: number) => void
}) {
  const progress = steps.length > 1 ? current / (steps.length - 1) : 1
  return (
    <nav aria-label="Signup progress">
      <div className="sm:hidden">
        <p className="text-xs font-medium text-muted-foreground">
          Step {current + 1} of {steps.length} · <span className="text-foreground">{steps[current]?.title}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${((current + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <ol className="relative hidden items-start justify-between sm:flex">
        <span aria-hidden className="absolute top-4 right-8 left-8 h-0.5 rounded-full bg-muted">
          <motion.span className="block h-full rounded-full bg-primary" animate={{ width: `${progress * 100}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
        </span>
        {steps.map((step, i) => {
          const done = i < current
          const active = i === current
          return (
            <li key={step.id} className="relative flex w-16 flex-col items-center gap-2" aria-current={active ? 'step' : undefined}>
              <button
                type="button"
                disabled={!done}
                onClick={() => onSelect(i)}
                aria-label={done ? `Back to ${step.title}` : `${step.title}${active ? ' (current step)' : ''}`}
                className={cn(
                  'flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  done && 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
                  active && 'border-primary bg-background text-foreground shadow-[0_0_0_4px] shadow-primary/20',
                  !done && !active && 'border-border bg-background text-muted-foreground',
                )}
              >
                {done ? <CheckIcon className="size-4" /> : i + 1}
              </button>
              <span className={cn('text-xs font-medium whitespace-nowrap', active || done ? 'text-foreground' : 'text-muted-foreground')}>{step.title}</span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
