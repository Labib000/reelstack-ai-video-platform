import { VISIBILITIES, type Visibility } from '@reelstack/shared'
import { GlobeIcon, LinkIcon, LockIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

const META: Record<Visibility, { icon: typeof GlobeIcon; hint: string }> = {
  public: { icon: GlobeIcon, hint: 'Anyone can find it' },
  unlisted: { icon: LinkIcon, hint: 'Only people with the link' },
  private: { icon: LockIcon, hint: 'Only you' },
}

export default function VisibilityPicker({ value, onChange, disabled }: { value: Visibility; onChange: (v: Visibility) => void; disabled?: boolean }) {
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Visibility</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {VISIBILITIES.map((v) => {
          const { icon: Icon, hint } = META[v]
          return (
            <button
              key={v}
              type="button"
              aria-pressed={value === v}
              onClick={() => onChange(v)}
              className={cn(
                'flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
                value === v ? 'border-primary bg-primary/10' : 'hover:bg-accent',
              )}
            >
              <Icon className={cn('mt-0.5 size-4 shrink-0', value === v ? 'text-link' : 'text-muted-foreground')} />
              <span>
                <span className="block text-sm font-medium capitalize">{v}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
