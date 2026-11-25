import type { AuditEntryDTO } from '@reelstack/shared'
import { describe, expect, it } from 'vitest'

import { describeAudit } from './audit'

const base: AuditEntryDTO = {
  id: '1',
  action: 'user.role_changed',
  actor: { id: 'a', name: 'Ada', username: 'ada' },
  target: { id: 'b', name: 'Bob Stone', username: null },
  video: null,
  meta: { from: 'user', to: 'moderator' },
  createdAt: '2026-11-24T10:00:00Z',
}

describe('describeAudit', () => {
  it('reads like a sentence', () => {
    expect(describeAudit(base)).toBe('@ada changed Bob Stone’s role from user to moderator')
    expect(describeAudit({ ...base, action: 'user.sessions_revoked', meta: { sessions: '1' } })).toBe('@ada signed Bob Stone out of 1 device')
    expect(describeAudit({ ...base, action: 'user.banned', target: null, meta: {} })).toBe('@ada suspended a deleted account')
    expect(describeAudit({ ...base, action: 'video.removed', video: { id: 'v', title: 'Clip' }, meta: { reason: 'Spam' } })).toBe('@ada removed Bob Stone’s video “Clip”')
    expect(describeAudit({ ...base, action: 'video.restored', meta: {} })).toBe('@ada restored Bob Stone’s video “a deleted video”')
  })
})
