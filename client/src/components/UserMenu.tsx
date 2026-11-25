import { type Role, type UserDTO, can } from '@reelstack/shared'
import { ClockIcon, HistoryIcon, HomeIcon, LaptopIcon, LayoutDashboardIcon, LibraryIcon, LogOutIcon, RotateCcwIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { toast } from 'sonner'

import { getStaffLanding, setStaffLanding } from '@/auth/staff-landing'

import { AppearanceSubmenu } from '@/components/AppearanceMenu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')

/** Moderators and admins get a badge; plain users don't need one. */
export function RoleBadge({ role }: { role: Role }) {
  if (role === 'user') return null
  return (
    <Badge variant={role === 'admin' ? 'default' : 'secondary'} className="capitalize">
      {role}
    </Badge>
  )
}

export default function UserMenu({ user, onLogout }: { user: UserDTO; onLogout: () => void }) {
  const inAdmin = useLocation().pathname.startsWith('/admin')
  const staff = can(user.role, 'moderation:view')
  const [landing, setLanding] = useState(() => (staff ? getStaffLanding(user.id) : null))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label="Open user menu"
        >
          <Avatar className="size-8">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
            <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{user.name}</p>
            <RoleBadge role={user.role} />
          </div>
          <p className="truncate text-xs text-muted-foreground">{user.username ? `@${user.username} · ` : ''}{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/library">
            <LibraryIcon />
            Library
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/history">
            <HistoryIcon />
            History
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/watch-later">
            <ClockIcon />
            Watch later
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/sessions">
            <LaptopIcon />
            Sessions
          </Link>
        </DropdownMenuItem>
        {staff &&
          (inAdmin ? (
            <DropdownMenuItem asChild>
              <Link to="/">
                <HomeIcon />
                Back to ReelStack
              </Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem asChild>
              <Link to="/admin">
                <LayoutDashboardIcon />
                Admin console
              </Link>
            </DropdownMenuItem>
          ))}
        {staff && landing && (
          <DropdownMenuItem
            onSelect={() => {
              setStaffLanding(user.id, null)
              setLanding(null)
              toast.success('You’ll be asked where to go next time you log in')
            }}
          >
            <RotateCcwIcon />
            Ask where to land after login
          </DropdownMenuItem>
        )}
        <AppearanceSubmenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOutIcon />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
