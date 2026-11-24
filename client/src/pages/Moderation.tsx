import { ShieldCheckIcon } from 'lucide-react'

import { useAuth } from '@/auth/context'
import { RoleBadge } from '@/components/UserMenu'

export default function Moderation() {
  const { user } = useAuth()
  return (
    <div className="glass mx-auto flex max-w-2xl flex-col items-center rounded-3xl px-6 py-16 text-center">
      <ShieldCheckIcon className="size-12 text-brand" />
      <h1 className="mt-4 flex items-center gap-2 font-display text-2xl font-bold">
        Moderation {user && <RoleBadge role={user.role} />}
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        Reports, flagged comments and failed processing jobs will appear here once videos and comments exist (Phases 2–4).
      </p>
    </div>
  )
}
