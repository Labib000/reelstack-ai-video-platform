import { MenuIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { AppearanceButton } from '@/components/AppearanceMenu'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

import NavSections from './NavSections'

/** The phone / tablet navigation: a drawer from the left (hidden from lg up). */
export default function MobileSidebar() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden">
          <MenuIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="glass w-72 gap-0 p-0">
        <div className="flex h-16 shrink-0 items-center border-b border-glass-border px-5">
          <Link to="/" onClick={close} aria-label="ReelStack home">
            <Logo className="h-7" />
          </Link>
        </div>
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">Site navigation</SheetDescription>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3">
          <NavSections onNavigate={close} rule="mobile-nav-rule" />
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-glass-border px-6 py-3 text-sm text-muted-foreground">
          Appearance
          <AppearanceButton />
        </div>
      </SheetContent>
    </Sheet>
  )
}
