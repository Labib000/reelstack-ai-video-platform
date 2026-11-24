import { CheckIcon, MinusIcon } from 'lucide-react'

import { scorePassword } from '@/lib/password'
import { cn } from '@/lib/utils'

const BAR = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-green-500']

/** Four-bar meter with the rule checklist under the password field. */
export default function PasswordStrength({ password }: { password: string }) {
  const { score, label, checks } = scorePassword(password)
  const rules = [
    { ok: checks.length, text: '8+ characters' },
    { ok: checks.letter, text: 'A letter' },
    { ok: checks.number, text: 'A number' },
    { ok: checks.symbol, text: 'A symbol (bonus)' },
  ]
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={cn('h-1.5 rounded-full transition-colors duration-300', password && score >= n ? BAR[score] : 'bg-muted')} />
          ))}
        </div>
        <span className="w-16 text-right text-xs font-medium text-muted-foreground">{password ? label : ''}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {rules.map((r) => (
          <li key={r.text} className={cn('flex items-center gap-1.5', r.ok ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
            {r.ok ? <CheckIcon className="size-3.5" /> : <MinusIcon className="size-3.5" />}
            {r.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
