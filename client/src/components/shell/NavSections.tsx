import { can } from '@reelstack/shared'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/context'
import { posterBackground } from '@/components/media/poster-palette'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CATEGORIES } from '@/data'
import { cn } from '@/lib/utils'

import { ACCOUNT_NAV, MAIN_NAV, MODERATION_NAV, type NavItem, YOU_NAV } from './nav'

interface Entry {
  to: string
  label: string
  icon: ReactNode
}

/** Matches path, plus the #hash or ?category when the link has one. */
function useIsActive() {
  const { pathname, search, hash } = useLocation()
  const category = new URLSearchParams(search).get('category')
  return (to: string, end?: boolean) => {
    const [path = '', rest = ''] = to.split(/(?=[?#])/)
    if (rest.startsWith('#')) return pathname === path && hash === rest
    if (rest.startsWith('?')) return pathname === path && category === new URLSearchParams(rest).get('category')
    if (pathname !== path && (end || !pathname.startsWith(`${path}/`))) return false
    // A plain link stops being active when a #hash / ?category sibling is.
    return !hash && !(path === '/explore' && category)
  }
}

/**
 * The navigation shared by the desktop glass panel and the phone drawer.
 * `collapsed` shows icons only (labels move to tooltips).
 */
export default function NavSections({
  collapsed = false,
  onNavigate,
  rule,
}: {
  collapsed?: boolean
  onNavigate?: () => void
  /** layoutId for the sliding active rule; unique per nav instance. */
  rule: string
}) {
  const { status, user } = useAuth()
  const isActive = useIsActive()

  const item = ({ to, label, icon }: Entry, end?: boolean) => {
    const active = isActive(to, end)
    const link = (
      <Link
        key={to}
        to={to}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        aria-label={collapsed ? label : undefined}
        className={cn(
          'relative flex h-10 items-center gap-3 rounded-xl text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
          collapsed ? 'justify-center px-0' : 'px-3',
          active ? 'bg-foreground/[0.07] font-semibold text-foreground' : 'text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground',
        )}
      >
        {active && <motion.span layoutId={rule} className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
        {icon}
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    )
    if (!collapsed) return link
    return (
      <Tooltip key={to}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  const navItem = (n: NavItem) => item({ to: n.to, label: n.label, icon: <n.icon className="size-[18px] shrink-0" /> }, n.end)

  const group = (title: string | null, children: ReactNode) => (
    <div className="space-y-0.5 border-b border-glass-border py-3 last:border-0">
      {title && !collapsed && <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</p>}
      <nav aria-label={title ?? 'Main'}>{children}</nav>
    </div>
  )

  return (
    <>
      {group(null, MAIN_NAV.map(navItem))}

      {status === 'authenticated'
        ? group('You', YOU_NAV.map(navItem))
        : status === 'guest' &&
          !collapsed && (
            <div className="border-b border-glass-border px-3 py-4">
              <p className="text-sm text-muted-foreground">Log in to like videos, save them for later and keep your history.</p>
              <Button asChild size="sm" className="mt-3 w-full rounded-full" onClick={onNavigate}>
                <Link to="/register">Create a free account</Link>
              </Button>
            </div>
          )}

      {group(
        'Topics',
        CATEGORIES.map((c) =>
          item({
            to: `/explore?category=${c}`,
            label: c,
            icon: <span className="size-[18px] shrink-0 rounded-md" style={{ background: posterBackground(c) }} />,
          }),
        ),
      )}

      {status === 'authenticated' &&
        group('Account', [...ACCOUNT_NAV, ...(can(user?.role, 'moderation:view') ? [MODERATION_NAV] : [])].map(navItem))}
    </>
  )
}
