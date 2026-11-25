import { type AdminUserDTO, ROLES, type Role, can } from '@reelstack/shared'
import { BanIcon, EyeIcon, LogOutIcon, MoreHorizontalIcon, ShieldIcon, UndoIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { banUser, revokeSessions, setRole, unbanUser } from '@/api/admin'
import { apiError } from '@/api/http'
import { useAuth } from '@/auth/context'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

type Pending = { kind: 'role'; role: Role } | { kind: 'ban' } | { kind: 'unban' } | { kind: 'revoke' } | null

/**
 * Row / detail actions for one user, with a confirmation step for each.
 * `onChange` receives the updated user (or a patch) to update lists in place.
 */
export default function UserActions({
  user,
  onChange,
  showView = true,
  variant = 'menu',
}: {
  user: AdminUserDTO
  onChange: (next: AdminUserDTO) => void
  showView?: boolean
  /** "menu": a ⋯ dropdown; "buttons": stacked buttons for the detail page. */
  variant?: 'menu' | 'buttons'
}) {
  const { user: me } = useAuth()
  const [pending, setPending] = useState<Pending>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const isSelf = me?.id === user.id
  const canRole = can(me?.role, 'user:set-role') && !isSelf
  const canBan = can(me?.role, 'user:ban') && !isSelf
  const banBlocked = user.role === 'admin'

  async function confirm() {
    if (!pending) return
    setBusy(true)
    try {
      if (pending.kind === 'role') {
        const updated = await setRole(user.id, pending.role)
        onChange({ ...user, role: updated.role })
        toast.success(`${user.name} is now ${pending.role === 'user' ? 'a regular user' : `a ${pending.role}`}`)
      } else if (pending.kind === 'ban') {
        onChange(await banUser(user.id, reason.trim()))
        toast.success(`${user.name} has been suspended and signed out`)
      } else if (pending.kind === 'unban') {
        onChange(await unbanUser(user.id))
        toast.success(`${user.name} can log in again`)
      } else {
        onChange(await revokeSessions(user.id))
        toast.success(`${user.name} was signed out of every device`)
      }
      setPending(null)
      setReason('')
    } catch (error) {
      const info = apiError(error)
      toast.error(info.fieldErrors.reason ?? info.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = {
    role: {
      title: `Make ${user.name} ${pending?.kind === 'role' && pending.role === 'admin' ? 'an' : 'a'} ${pending?.kind === 'role' ? pending.role : ''}?`,
      body:
        pending?.kind === 'role' && pending.role === 'admin'
          ? 'Admins can manage every account, including suspending users and changing roles. It takes effect on their next request.'
          : 'It takes effect on their next request. You can change it back any time.',
      action: 'Change role',
    },
    ban: {
      title: `Suspend ${user.name}?`,
      body: 'They’ll be signed out of every device straight away and won’t be able to log in until you lift the suspension.',
      action: 'Suspend account',
    },
    unban: { title: `Lift ${user.name}’s suspension?`, body: 'They’ll be able to log in again. Their old sessions stay signed out.', action: 'Lift suspension' },
    revoke: {
      title: `Sign ${user.name} out everywhere?`,
      body: `Ends ${user.activeSessions === 1 ? 'their 1 active session' : `all ${user.activeSessions} active sessions`}. They can log straight back in.`,
      action: 'Sign out everywhere',
    },
  }[pending?.kind ?? 'revoke']

  const dialog = (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !busy && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        {pending?.kind === 'ban' && (
          <div className="space-y-2">
            <Label htmlFor="ban-reason">Reason (shown in the audit log)</Label>
            <Textarea id="ban-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Posting spam links in comments" maxLength={200} rows={3} autoFocus />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void confirm()
            }}
            disabled={busy || (pending?.kind === 'ban' && reason.trim().length < 3)}
            className={pending?.kind === 'ban' ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
          >
            {busy && <Spinner />}
            {copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (variant === 'buttons') {
    return (
      <div className="grid gap-2">
        {canRole && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="justify-start">
                <ShieldIcon /> Change role
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuRadioGroup value={user.role} onValueChange={(r) => r !== user.role && setPending({ kind: 'role', role: r as Role })}>
                {ROLES.map((r) => (
                  <DropdownMenuRadioItem key={r} value={r} className="capitalize">
                    {r}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {canBan && (
          <Button variant="outline" className="justify-start" disabled={user.activeSessions === 0} onClick={() => setPending({ kind: 'revoke' })}>
            <LogOutIcon /> Sign out everywhere
          </Button>
        )}
        {canBan &&
          (user.bannedAt ? (
            <Button variant="outline" className="justify-start" onClick={() => setPending({ kind: 'unban' })}>
              <UndoIcon /> Lift suspension
            </Button>
          ) : (
            <Button variant="outline" className="justify-start text-destructive-foreground hover:text-destructive-foreground" disabled={banBlocked} title={banBlocked ? 'Change their role first' : undefined} onClick={() => setPending({ kind: 'ban' })}>
              <BanIcon /> Suspend account
            </Button>
          ))}
        {isSelf && <p className="text-xs text-muted-foreground">This is you. Use Sessions to manage your own devices.</p>}
        {dialog}
      </div>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={`Actions for ${user.name}`}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{user.username ? `@${user.username}` : user.email}</DropdownMenuLabel>
          {showView && (
            <DropdownMenuItem asChild>
              <Link to={`/admin/users/${user.id}`}>
                <EyeIcon /> View details
              </Link>
            </DropdownMenuItem>
          )}
          {canRole && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="gap-2">
                <ShieldIcon className="size-4 text-muted-foreground" /> Change role
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={user.role} onValueChange={(r) => r !== user.role && setPending({ kind: 'role', role: r as Role })}>
                  {ROLES.map((r) => (
                    <DropdownMenuRadioItem key={r} value={r} className="capitalize">
                      {r}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {canBan && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={user.activeSessions === 0} onSelect={() => setPending({ kind: 'revoke' })}>
                <LogOutIcon /> Sign out everywhere
              </DropdownMenuItem>
              {user.bannedAt ? (
                <DropdownMenuItem onSelect={() => setPending({ kind: 'unban' })}>
                  <UndoIcon /> Lift suspension
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem variant="destructive" disabled={banBlocked} onSelect={() => setPending({ kind: 'ban' })}>
                  <BanIcon /> {banBlocked ? 'Can’t suspend an admin' : 'Suspend account'}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog}
    </>
  )
}
