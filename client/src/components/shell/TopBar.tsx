import { PlusIcon, SearchIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useAuth } from '@/auth/context'
import UserMenu from '@/components/UserMenu'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'

import { useAskPalette } from './ask-palette-context'
import MobileSidebar from './MobileSidebar'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * lg+: search/ask in the middle, Upload and (guests) Log in on the right;
 * navigation and the account live in the glass sidebar. Below lg: menu
 * button, logo, search icon and avatar.
 */
export default function TopBar() {
  const { status, user, logout } = useAuth()
  const palette = useAskPalette()

  return (
    // lg+: a floating glass strip; the faded backing hides content scrolling through the gap above it.
    <div className="sticky top-0 z-30 lg:bg-gradient-to-b lg:from-background lg:from-40% lg:to-transparent lg:px-3 lg:pt-3 lg:pb-1">
    <header className="border-b border-glass-border bg-background/70 backdrop-blur-xl lg:rounded-2xl lg:border">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-2 px-3 sm:px-5">
        <MobileSidebar />
        <Link to="/" aria-label="ReelStack home" className="shrink-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
          <Logo className="hidden h-7 sm:inline-flex" />
          <LogoMark className="h-7 sm:hidden" />
        </Link>

        <button
          type="button"
          onClick={palette.open}
          className="ml-auto hidden h-10 w-full max-w-md items-center gap-2 rounded-full border border-glass-border bg-foreground/[0.04] px-4 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex lg:mx-auto"
        >
          <SearchIcon className="size-4" />
          <span className="truncate">Search or ask…</span>
          <kbd className="ml-auto rounded-md border border-glass-border px-1.5 py-0.5 text-[11px] font-medium">{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-0">
          <Button variant="ghost" size="icon" aria-label="Search or ask" onClick={palette.open} className="md:hidden">
            <SearchIcon />
          </Button>
          <Button asChild size="sm" className="hidden rounded-full sm:inline-flex">
            <Link to="/upload">
              <PlusIcon /> Upload
            </Link>
          </Button>
          {status === 'authenticated' && user ? (
            <span className="ml-1 lg:hidden">
              <UserMenu user={user} onLogout={() => void logout()} />
            </span>
          ) : status === 'guest' ? (
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Log in</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
    </div>
  )
}
