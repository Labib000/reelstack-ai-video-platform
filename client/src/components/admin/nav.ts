import type { Permission } from '@reelstack/shared'
import { FileClockIcon, FlagIcon, LayoutDashboardIcon, type LucideIcon, UsersIcon, VideoIcon } from 'lucide-react'

export interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Hidden unless the role grants this. Console access itself is moderation:view. */
  permission?: Permission
  badge?: string
}

export const ADMIN_NAV: { title: string; items: AdminNavItem[] }[] = [
  { title: 'Overview', items: [{ to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon }] },
  {
    title: 'Content',
    items: [
      { to: '/admin/videos', label: 'Videos', icon: VideoIcon },
      { to: '/admin/reports', label: 'Reports', icon: FlagIcon, badge: 'Demo' },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/admin/users', label: 'Users', icon: UsersIcon, permission: 'user:view' },
      { to: '/admin/audit', label: 'Audit log', icon: FileClockIcon, permission: 'audit:view' },
    ],
  },
]

/** Page titles for the breadcrumb. */
export const ADMIN_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  users: 'Users',
  videos: 'Videos',
  reports: 'Reports',
  audit: 'Audit log',
}
