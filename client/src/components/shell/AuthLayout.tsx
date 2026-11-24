import { Link } from 'react-router-dom'

import { AppearanceButton } from '@/components/AppearanceMenu'
import AuthShowcase, { AuthShowcaseStrip } from '@/components/auth/AuthShowcase'
import { Logo } from '@/components/brand/Logo'
import { TooltipProvider } from '@/components/ui/tooltip'

import AnimatedOutlet from './AnimatedOutlet'

const YEAR = new Date().getFullYear()

/**
 * Login / register. lg+: showcase (with the brand) on the left, the form
 * centred on the right. Smaller: logo bar, a slim strip of screens, the form.
 */
export default function AuthLayout() {
  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-svh lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <AuthShowcase className="sticky top-0 hidden lg:block" />

        <div className="relative isolate flex min-h-svh flex-col overflow-hidden">
          {/* Soft brand glow and a faint dot grid, so the form side isn't flat. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgb(247_30_37/0.10),transparent_70%)]" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_45%,black,transparent)] opacity-[0.35] [background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:22px_22px]"
          />

          <header className="flex h-16 shrink-0 items-center justify-between px-5 sm:px-8 lg:absolute lg:inset-x-0 lg:top-0 lg:z-10 lg:h-20 lg:justify-end lg:px-10">
            <Link to="/" aria-label="ReelStack home" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
              <Logo className="h-7" />
            </Link>
            <AppearanceButton />
          </header>
          <AuthShowcaseStrip />
          <main className="flex flex-1 items-start justify-center px-5 pb-10 sm:items-center sm:px-8 lg:px-10 lg:py-24">
            <div className="w-full max-w-md">
              <AnimatedOutlet />
            </div>
          </main>
          <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 pb-6 text-xs text-muted-foreground sm:px-8 lg:absolute lg:inset-x-0 lg:bottom-0">
            <span>© {YEAR} ReelStack</span>
            <span aria-hidden>·</span>
            <span>Terms</span>
            <span aria-hidden>·</span>
            <span>Privacy</span>
            <span aria-hidden>·</span>
            <span>Help</span>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  )
}
