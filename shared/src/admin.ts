import { z } from 'zod';

import { INTERESTS, roleSchema, userDtoSchema } from './auth.js';

/** A user as the admin console sees them: the public DTO plus account state. */
export const adminUserDtoSchema = userDtoSchema.extend({
    bannedAt: z.string().nullable(),
    banReason: z.string().nullable(),
    lastLoginAt: z.string().nullable(),
    interests: z.array(z.string()),
    /** Signed-in devices (live refresh-token families). */
    activeSessions: z.number().int(),
});
export type AdminUserDTO = z.infer<typeof adminUserDtoSchema>;

export const USER_SORTS = ['newest', 'oldest', 'name', 'last-login'] as const;
export const USER_STATUSES = ['active', 'banned'] as const;

/** GET /api/admin/users query string. */
export const adminUserListQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    role: roleSchema.optional(),
    status: z.enum(USER_STATUSES).optional(),
    sort: z.enum(USER_SORTS).default('newest'),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminUserListQuery = z.input<typeof adminUserListQuerySchema>;

/** A page of results. */
export const pageSchema = <T extends z.ZodType>(item: T) =>
    z.object({
        items: z.array(item),
        total: z.number().int(),
        page: z.number().int(),
        pageSize: z.number().int(),
    });
export interface Page<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
}

export const banSchema = z.object({
    reason: z.string().trim().min(3, 'Give a short reason (3+ characters)').max(200, 'Keep it under 200 characters'),
});
export type BanInput = z.infer<typeof banSchema>;

export const adminStatsSchema = z.object({
    users: z.object({
        total: z.number().int(),
        new7d: z.number().int(),
        new30d: z.number().int(),
        /** New users in the 7 days before the last 7, for the trend arrow. */
        prev7d: z.number().int(),
        banned: z.number().int(),
        byRole: z.object({ user: z.number().int(), moderator: z.number().int(), admin: z.number().int() }),
    }),
    activeSessions: z.number().int(),
    /** Last 30 days, oldest first, every day present (zero-filled). */
    signupsByDay: z.array(z.object({ date: z.string(), count: z.number().int() })),
    topInterests: z.array(z.object({ interest: z.enum(INTERESTS), count: z.number().int() })),
    recentSignups: z.array(adminUserDtoSchema),
    videos: z.object({
        total: z.number().int(),
        uploading: z.number().int(),
        processing: z.number().int(),
        failed: z.number().int(),
        storageBytes: z.number(),
    }),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

export const AUDIT_ACTIONS = [
    'user.role_changed',
    'user.banned',
    'user.unbanned',
    'user.sessions_revoked',
    'video.removed',
    'video.restored',
    'video.reprocessed',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const auditPersonSchema = z.object({ id: z.string(), name: z.string(), username: z.string().nullable() });

export const auditEntryDtoSchema = z.object({
    id: z.string(),
    action: z.enum(AUDIT_ACTIONS),
    actor: auditPersonSchema.nullable(),
    target: auditPersonSchema.nullable(),
    /** Set for video actions. */
    video: z.object({ id: z.string(), title: z.string() }).nullable(),
    /** e.g. { from: 'user', to: 'moderator' } or { reason: '…' }. */
    meta: z.record(z.string(), z.string()),
    createdAt: z.string(),
});
export type AuditEntryDTO = z.infer<typeof auditEntryDtoSchema>;

export const auditListQuerySchema = z.object({
    action: z.enum(AUDIT_ACTIONS).optional(),
    /** Only entries about this user. */
    target: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
export type AuditListQuery = z.input<typeof auditListQuerySchema>;
