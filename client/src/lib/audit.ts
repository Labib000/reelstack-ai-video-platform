import type { AuditEntryDTO } from '@reelstack/shared'

const who = (p: AuditEntryDTO['actor']) => (p ? (p.username ? `@${p.username}` : p.name) : 'Someone')

/** One readable line for an audit entry, e.g. "@ada changed @bob's role from user to moderator". */
export function describeAudit(e: AuditEntryDTO): string {
  const actor = who(e.actor)
  const target = e.target ? who(e.target) : 'a deleted account'
  const video = e.video?.title ?? 'a deleted video'
  switch (e.action) {
    case 'user.role_changed':
      return `${actor} changed ${target}’s role from ${e.meta.from ?? '?'} to ${e.meta.to ?? '?'}`
    case 'user.banned':
      return `${actor} suspended ${target}`
    case 'user.unbanned':
      return `${actor} lifted ${target}’s suspension`
    case 'user.sessions_revoked': {
      const n = Number(e.meta.sessions ?? 0)
      return `${actor} signed ${target} out of ${n === 1 ? '1 device' : `${n} devices`}`
    }
    case 'video.removed':
      return `${actor} removed ${target}’s video “${video}”`
    case 'video.restored':
      return `${actor} restored ${target}’s video “${video}”`
    case 'video.reprocessed':
      return `${actor} re-ran the file check on ${target}’s video “${video}”`
  }
}

export const AUDIT_LABELS: Record<AuditEntryDTO['action'], string> = {
  'user.role_changed': 'Role changes',
  'user.banned': 'Suspensions',
  'user.unbanned': 'Reinstatements',
  'user.sessions_revoked': 'Forced sign-outs',
  'video.removed': 'Video removals',
  'video.restored': 'Video restores',
  'video.reprocessed': 'Video reprocessing',
}
