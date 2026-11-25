import type { Role } from './auth.js';

/**
 * Who may do what. Shared so the server enforces it and the client can hide
 * buttons the user can't use (the server check is the one that matters).
 * Editing or deleting your *own* content is an ownership check, not a
 * permission: these are the powers over other people's content and accounts.
 */
export const PERMISSIONS = {
    /** Remove or unlist anyone's video. */
    'video:moderate': ['moderator', 'admin'],
    /** Delete anyone's comment. */
    'comment:moderate': ['moderator', 'admin'],
    /** See reports, failed jobs and the moderation queue. */
    'moderation:view': ['moderator', 'admin'],
    /** Ban or unban an account. */
    'user:ban': ['admin'],
    /** Promote or demote between user, moderator and admin. */
    'user:set-role': ['admin'],
    /** Browse and search all accounts (emails included). */
    'user:view': ['admin'],
    /** Read the admin audit log. */
    'audit:view': ['admin'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
    return role != null && (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
