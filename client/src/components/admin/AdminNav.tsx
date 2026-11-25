import { can } from '@reelstack/shared'
import { motion } from 'motion/react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/context'
import { cn } from '@/lib/utils'

import { ADMIN_NAV } from './nav'

/** Console navigation, shared by the desktop panel and the phone drawer. */
export default function AdminNav({ onNavigate, rule }: { onNavigate?: () => void; rule: string }) {
  const { user } = useAuth()
  const { pathname } = useLocation()

  return (
    <>
      {ADMIN_NAV.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(user?.role, i.permission))
        if (items.length === 0) return null
        return (
          <div key={group.title} className="space-y-0.5 border-b border-glass-border py-3 last:border-0">
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{group.title}</p>
            <nav aria-label={group.title}>
              {items.map(({ to, label, icon: Icon, badge }) => {
                const active = pathname === to || pathname.startsWith(`${to}/`)
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'bg-foreground/[0.07] font-semibold text-foreground' : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
                    )}
                  >
                    {active && <motion.span layoutId={rule} className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                    <Icon className="size-[18px] shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {badge && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{badge}</span>}
                  </Link>
                )
              })}
            </nav>
          </div>
        )
      })}
    </>
  )
}
