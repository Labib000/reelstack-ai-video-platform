import { type ApiErrorBody, type Permission, can } from '@reelstack/shared';
import type { RequestHandler } from 'express';

/**
 * 403 unless the signed-in user's role grants `permission`. Use after
 * requireAuth, e.g. router.delete('/:id', auth, requirePermission('video:moderate'), …).
 */
export function requirePermission(permission: Permission): RequestHandler {
    return (req, res, next) => {
        if (!can(req.user?.role, permission)) {
            const body: ApiErrorBody = {
                message: 'You do not have permission to do that.',
            };
            res.status(403).json(body);
            return;
        }
        next();
    };
}
