import { type Role, type UserDTO, can } from '@reelstack/shared'
import { ClockIcon, HistoryIcon, LaptopIcon, LibraryIcon, LogOutIcon, ShieldCheckIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router-dom'

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
        {can(user.role, 'moderation:view') && (
          <DropdownMenuItem asChild>
            <Link to="/moderation">
              <ShieldCheckIcon />
              Moderation
            </Link>
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
