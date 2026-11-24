import { INTERESTS, type Interest } from '@reelstack/shared'
import { BriefcaseIcon, CameraIcon, CheckIcon, ClapperboardIcon, Code2Icon, FlaskConicalIcon, type LucideIcon, MusicIcon, PaletteIcon, UtensilsCrossedIcon } from 'lucide-react'
import { motion } from 'motion/react'

import { cn } from '@/lib/utils'

const ICONS: Record<Interest, LucideIcon> = {
  Programming: Code2Icon,
  Science: FlaskConicalIcon,
  Design: PaletteIcon,
  'Film & editing': ClapperboardIcon,
  Food: UtensilsCrossedIcon,
  Business: BriefcaseIcon,
  Photography: CameraIcon,
  Music: MusicIcon,
}

export const MAX_INTERESTS = 5

/** Toggle tiles for 1–5 topics. */
export default function InterestPicker({
  value,
  onChange,
  invalid,
}: {
  value: Interest[]
  onChange: (next: Interest[]) => void
  invalid?: boolean
}) {
  const full = value.length >= MAX_INTERESTS
  return (
    <div className="space-y-2">
      <div role="group" aria-label="Topics" aria-invalid={invalid} className="grid grid-cols-2 gap-2">
        {INTERESTS.map((interest) => {
          const Icon = ICONS[interest]
          const on = value.includes(interest)
          return (
            <motion.button
              key={interest}
              type="button"
              whileTap={{ scale: 0.96 }}
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onChange(on ? value.filter((v) => v !== interest) : [...value, interest])}
              className={cn(
                'relative flex min-h-12 items-center gap-2.5 rounded-xl border py-2.5 pr-8 pl-3 text-left text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40',
                on ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:border-foreground/30 hover:bg-accent/50',
                invalid && !on && 'border-destructive/50',
              )}
            >
              <Icon className={cn('size-4.5 shrink-0', on ? 'text-brand' : 'text-muted-foreground')} />
              <span className="leading-tight">{interest}</span>
              {on && (
                <span className="absolute top-1/2 right-2.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckIcon className="size-3" />
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length} of {MAX_INTERESTS} selected{full && ' · that’s the maximum'}
      </p>
    </div>
  )
}
