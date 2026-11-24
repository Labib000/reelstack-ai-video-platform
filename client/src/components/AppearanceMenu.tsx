import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { type Appearance, useAppearance } from '@/hooks/use-appearance'

const OPTIONS = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
] as const satisfies { value: Appearance; label: string; icon: typeof SunIcon }[]

function Items() {
  const { appearance, updateAppearance } = useAppearance()
  return OPTIONS.map(({ value, label, icon: Icon }) => (
    <DropdownMenuItem key={value} onSelect={() => updateAppearance(value)}>
      <Icon />
      {label}
      {appearance === value && <CheckIcon className="ml-auto" />}
    </DropdownMenuItem>
  ))
}

/** Theme submenu, for inside the user menu. */
export function AppearanceSubmenu() {
  const { resolvedAppearance } = useAppearance()
  const Icon = resolvedAppearance === 'dark' ? MoonIcon : SunIcon
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon className="size-4 text-muted-foreground" />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <Items />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

/** Standalone theme button (for guests, who have no user menu). */
export function AppearanceButton() {
  const { resolvedAppearance } = useAppearance()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme">
          {resolvedAppearance === 'dark' ? <MoonIcon /> : <SunIcon />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Items />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
