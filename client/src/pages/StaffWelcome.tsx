import { ArrowRightIcon, CompassIcon, LayoutDashboardIcon, LibraryIcon, PlayIcon, UsersIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { getStats } from '@/api/admin'
import { useAuth } from '@/auth/context'
import { type StaffLanding, landingPath, setStaffLanding } from '@/auth/staff-landing'
import AuthPanel from '@/components/auth/AuthPanel'
import { RoleBadge } from '@/components/UserMenu'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useRequest } from '@/hooks/use-request'
import { cn } from '@/lib/utils'

/** After a staff member logs in: "Admin console or ReelStack?" */
export default function StaffWelcome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [remember, setRemember] = useState(false)
  const stats = useRequest('welcome-stats', getStats)

  if (!user) return null
  const first = user.name.split(' ')[0]

  const choose = (choice: StaffLanding) => {
    setStaffLanding(user.id, remember ? choice : null)
    navigate(landingPath(choice), { replace: true })
  }

  const option = (choice: StaffLanding, icon: React.ReactNode, title: string, body: React.ReactNode, accent: boolean) => (
    <motion.button
      type="button"
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => choose(choice)}
      className={cn(
        'group flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        accent ? 'border-primary/40 bg-primary/[0.07] hover:border-primary/70' : 'border-border hover:border-foreground/30 hover:bg-accent/40',
      )}
    >
      <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', accent ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-display text-lg font-semibold">
          {title}
          <ArrowRightIcon className="size-4 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
        </span>
        <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
      </span>
    </motion.button>
  )

  return (
    <AuthPanel>
      <div className="space-y-1.5">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          Signed in as <RoleBadge role={user.role} />
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight">Welcome back, {first}</h1>
        <p className="text-sm text-muted-foreground">Where would you like to start?</p>
      </div>

      <div className="grid gap-3">
        {option(
          'admin',
          <LayoutDashboardIcon className="size-5" />,
          'Admin console',
          stats.data ? (
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <UsersIcon className="size-3.5" /> {stats.data.users.new7d} new this week
              </span>
              <span>{stats.data.activeSessions} active sessions</span>
            </span>
          ) : (
            'Dashboard, users, reports and the audit log.'
          ),
          true,
        )}
        {option(
          'app',
          <PlayIcon className="size-5" />,
          'Continue to ReelStack',
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <CompassIcon className="size-3.5" /> Explore
            </span>
            <span className="inline-flex items-center gap-1">
              <LibraryIcon className="size-3.5" /> Your library
            </span>
          </span>,
          false,
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <Checkbox id="remember-landing" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
        <Label htmlFor="remember-landing" className="text-sm font-normal text-muted-foreground">
          Remember my choice on this device
        </Label>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        You can switch any time from your avatar menu. <Link to="/" className="underline-offset-2 hover:underline">Skip</Link>
      </p>
    </AuthPanel>
  )
}
