import type {
  AdminStats,
  AdminUserDTO,
  AdminUserListQuery,
  AuditEntryDTO,
  AuditListQuery,
  Page,
  Role,
  UserDTO,
} from '@reelstack/shared'

import { api } from './http'

/** Drops empty values so they don't end up as `?q=` in the URL. */
const clean = (params: object) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))

export const getStats = (signal?: AbortSignal) => api.get<AdminStats>('/admin/stats', { signal }).then((r) => r.data)

export const listUsers = (query: AdminUserListQuery, signal?: AbortSignal) =>
  api.get<Page<AdminUserDTO>>('/admin/users', { params: clean(query), signal }).then((r) => r.data)

export const getUser = (id: string, signal?: AbortSignal) =>
  api.get<{ user: AdminUserDTO }>(`/admin/users/${id}`, { signal }).then((r) => r.data.user)

export const setRole = (id: string, role: Role) =>
  api.patch<{ user: UserDTO }>(`/admin/users/${id}/role`, { role }).then((r) => r.data.user)

export const banUser = (id: string, reason: string) =>
  api.post<{ user: AdminUserDTO }>(`/admin/users/${id}/ban`, { reason }).then((r) => r.data.user)

export const unbanUser = (id: string) => api.post<{ user: AdminUserDTO }>(`/admin/users/${id}/unban`).then((r) => r.data.user)

export const revokeSessions = (id: string) =>
  api.post<{ user: AdminUserDTO }>(`/admin/users/${id}/revoke-sessions`).then((r) => r.data.user)

export const listAudit = (query: AuditListQuery, signal?: AbortSignal) =>
  api.get<Page<AuditEntryDTO>>('/admin/audit', { params: clean(query), signal }).then((r) => r.data)
