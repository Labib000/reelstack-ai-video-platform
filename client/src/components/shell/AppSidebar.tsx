import { PanelLeftCloseIcon, PanelLeftOpenIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/context'
import { AppearanceButton } from '@/components/AppearanceMenu'
import UserMenu, { RoleBadge } from '@/components/UserMenu'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import NavSections from './NavSections'

export const RAIL_OPEN = 240
export const RAIL_COLLAPSED = 72

/**
 * Desktop navigation: a floating glass panel pinned to the window (not the
 * page). `fixed` with top and bottom insets keeps it exactly window-height,
 * so the footer always sits at the bottom of the screen while the page
 * scrolls; the middle scrolls inside the panel if the window is short.
 */
export default function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { status, user, logout } = useAuth()

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? RAIL_COLLAPSED : RAIL_OPEN }}
      transition={{ type: 'spring', stiffness: 380, damping: 36 }}
      className="glass fixed top-3 bottom-3 left-3 z-40 hidden flex-col overflow-hidden rounded-2xl shadow-2xl shadow-black/20 backdrop-blur-2xl lg:flex"
    >
      <div className={cn('flex h-16 shrink-0 items-center border-b border-glass-border', collapsed ? 'justify-center' : 'justify-between pr-2 pl-4')}>
        {!collapsed && (
          <Link to="/" aria-label="ReelStack home" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo className="h-7" />
          </Link>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
          {collapsed ? <PanelLeftOpenIcon /> : <PanelLeftCloseIcon />}
        </Button>
      </div>

      <div className={cn('no-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
        {collapsed && (
          <Link to="/" aria-label="ReelStack home" className="flex justify-center pt-3">
            <LogoMark className="h-6" />
          </Link>
        )}
        <NavSections collapsed={collapsed} rule="desktop-nav-rule" />
      </div>

      {/* Pinned to the bottom of the window. */}
      <div className={cn('shrink-0 border-t border-glass-border p-2', collapsed ? 'flex flex-col items-center gap-2' : 'space-y-1')}>
        {status === 'authenticated' && user ? (
          <div className={cn('flex items-center gap-3 rounded-xl', !collapsed && 'p-1.5')}>
            <UserMenu user={user} onLogout={() => void logout()} />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <span className="truncate">{user.name}</span>
                  <RoleBadge role={user.role} />
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.username ? `@${user.username}` : user.email}</p>
              </div>
            )}
            {!collapsed && <AppearanceButton />}
          </div>
        ) : (
          status === 'guest' &&
          (collapsed ? null : (
            <div className="flex items-center gap-2 p-1">
              <Button asChild variant="outline" size="sm" className="flex-1 rounded-full">
                <Link to="/login">Log in</Link>
              </Button>
              <AppearanceButton />
            </div>
          ))
        )}
        {collapsed && <AppearanceButton />}
      </div>
    </motion.aside>
  )
}
