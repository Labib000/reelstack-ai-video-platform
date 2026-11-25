import { ArrowLeftIcon, ChevronRightIcon, MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '@/auth/context'
import { AppearanceButton } from '@/components/AppearanceMenu'
import UserMenu, { RoleBadge } from '@/components/UserMenu'
import { Logo } from '@/components/brand/Logo'
import AnimatedOutlet from '@/components/shell/AnimatedOutlet'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'

import AdminNav from './AdminNav'
import { ADMIN_TITLES } from './nav'

function ConsoleBrand() {
  return (
    <Link to="/admin" className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Admin console home">
      <Logo className="h-6" />
      <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-brand uppercase">Admin</span>
    </Link>
  )
}

function BackToApp({ onClick }: { onClick?: () => void }) {
  return (
    <Button asChild variant="outline" size="sm" className="w-full justify-start rounded-xl" onClick={onClick}>
      <Link to="/">
        <ArrowLeftIcon /> Back to ReelStack
      </Link>
    </Button>
  )
}

/** "Admin › Users › Ada Lovelace" from the path (detail pages pass their own last crumb via title). */
function Breadcrumbs() {
  const { pathname } = useLocation()
  const parts = pathname.split('/').filter(Boolean).slice(1)
  const section = parts[0] ?? 'dashboard'
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
      <Link to="/admin" className="text-muted-foreground hover:text-foreground">
        Admin
      </Link>
      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
      {parts.length > 1 ? (
        <>
          <Link to={`/admin/${section}`} className="text-muted-foreground hover:text-foreground">
            {ADMIN_TITLES[section] ?? section}
          </Link>
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">Details</span>
        </>
      ) : (
        <span className="truncate font-medium">{ADMIN_TITLES[section] ?? section}</span>
      )}
    </nav>
  )
}

function MobileAdminNav() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open admin menu" className="lg:hidden">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="glass w-72 gap-0 p-0">
        <div className="flex h-16 shrink-0 items-center border-b border-glass-border px-5">
          <ConsoleBrand />
        </div>
        <SheetTitle className="sr-only">Admin menu</SheetTitle>
        <SheetDescription className="sr-only">Admin console navigation</SheetDescription>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3">
          <AdminNav onNavigate={close} rule="admin-mobile-rule" />
        </div>
        <div className="shrink-0 border-t border-glass-border p-3">
          <BackToApp onClick={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * The admin console shell: its own floating glass sidebar (same look as the
 * app's) so it's obvious you're "backstage", plus a breadcrumb top bar.
 */
export default function AdminLayout() {
  const { user, logout } = useAuth()

  return (
    <TooltipProvider delayDuration={150}>
      <aside className="glass fixed top-3 bottom-3 left-3 z-40 hidden w-[240px] flex-col overflow-hidden rounded-2xl shadow-2xl shadow-black/20 backdrop-blur-2xl lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-glass-border px-4">
          <ConsoleBrand />
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3">
          <AdminNav rule="admin-desktop-rule" />
        </div>
        <div className="shrink-0 space-y-2 border-t border-glass-border p-2">
          <BackToApp />
          {user && (
            <div className="flex items-center gap-3 rounded-xl p-1.5">
              <UserMenu user={user} onLogout={() => void logout()} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                  <span className="truncate">{user.name}</span>
                  <RoleBadge role={user.role} />
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.username ? `@${user.username}` : user.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="min-h-screen lg:pl-[252px]">
        <div className="sticky top-0 z-30 lg:px-3 lg:pt-3">
          <header className="flex h-14 items-center gap-2 border-b border-glass-border bg-background/80 px-3 backdrop-blur-xl sm:px-4 lg:h-12 lg:rounded-2xl lg:border lg:bg-glass">
            <MobileAdminNav />
            <div className="lg:hidden">
              <ConsoleBrand />
            </div>
            <div className="hidden min-w-0 flex-1 lg:block">
              <Breadcrumbs />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <AppearanceButton />
              {user && (
                <div className="lg:hidden">
                  <UserMenu user={user} onLogout={() => void logout()} />
                </div>
              )}
            </div>
          </header>
        </div>
        <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-20 sm:px-5 lg:px-6">
          <div className="mb-4 lg:hidden">
            <Breadcrumbs />
          </div>
          <AnimatedOutlet />
        </main>
      </div>
    </TooltipProvider>
  )
}
