import {
  ClapperboardIcon,
  ClockIcon,
  CompassIcon,
  HeartIcon,
  HistoryIcon,
  HomeIcon,
  LaptopIcon,
  LibraryIcon,
  type LucideIcon,
  ShieldCheckIcon,
  TvIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

/** The main destinations: top bar on desktop, top of the drawer on phones. */
export const MAIN_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/explore', label: 'Explore', icon: CompassIcon },
  { to: '/subscriptions', label: 'Subscriptions', icon: TvIcon },
  { to: '/library', label: 'Library', icon: LibraryIcon },
]

export const YOU_NAV: NavItem[] = [
  { to: '/history', label: 'History', icon: HistoryIcon },
  { to: '/watch-later', label: 'Watch later', icon: ClockIcon },
  { to: '/liked', label: 'Liked videos', icon: HeartIcon },
  { to: '/library#your-videos', label: 'Your videos', icon: ClapperboardIcon },
]

export const ACCOUNT_NAV: NavItem[] = [{ to: '/sessions', label: 'Sessions', icon: LaptopIcon }]
export const MODERATION_NAV: NavItem = { to: '/moderation', label: 'Moderation', icon: ShieldCheckIcon }
