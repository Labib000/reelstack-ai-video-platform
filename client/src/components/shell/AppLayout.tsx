import { type CSSProperties, useState } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'

import AnimatedOutlet from './AnimatedOutlet'
import AppSidebar, { RAIL_COLLAPSED, RAIL_OPEN } from './AppSidebar'
import TopBar from './TopBar'

const KEY = 'reelstack:sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? '0' : '1')
      } catch {
        // Private mode or blocked storage: just don't remember it.
      }
      return !c
    })

  return (
    <TooltipProvider delayDuration={150}>
      <AppSidebar collapsed={collapsed} onToggle={toggle} />
      {/* On lg+, everything sits to the right of the floating panel (its width + gaps). */}
      <div
        className="min-h-screen transition-[padding] duration-300 lg:pl-[calc(var(--rail)+12px)]"
        style={{ '--rail': `${collapsed ? RAIL_COLLAPSED : RAIL_OPEN}px` } as CSSProperties}
      >
        <TopBar />
        <main className="mx-auto max-w-[1400px] px-4 pt-6 pb-20 sm:px-5 lg:px-6">
          <AnimatedOutlet />
        </main>
      </div>
    </TooltipProvider>
  )
}
