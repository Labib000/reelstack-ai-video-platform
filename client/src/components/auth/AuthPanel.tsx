import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** The form surface: borderless on phones, a glass card from sm up. */
export default function AuthPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'space-y-6 sm:rounded-3xl sm:border sm:border-glass-border sm:bg-card/70 sm:p-8 sm:shadow-2xl sm:shadow-black/20 sm:backdrop-blur-xl sm:[box-shadow:inset_0_1px_0_rgb(255_255_255/0.05),0_25px_50px_-12px_rgb(0_0_0/0.25)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
