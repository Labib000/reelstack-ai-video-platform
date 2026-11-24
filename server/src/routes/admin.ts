import { roleSchema } from '@reelstack/shared';
import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import { z } from 'zod';

import type { Config } from '../config.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { parseOr422 } from '../middleware/validate.js';
import { User, toUserDTO } from '../models/User.js';

const setRoleSchema = z.object({ role: roleSchema });

export function createAdminRouter(config: Config): Router {
    const router = Router();
    router.use(requireAuth(config));

    /** Promote or demote a user. Admins can't change their own role. */
    router.patch(
        '/users/:id/role',
        requirePermission('user:set-role'),
        async (req, res) => {
            const { id } = req.params as { id: string };
            const input = parseOr422(setRoleSchema, req.body, res);
            if (!input) return;

            if (id === req.user!.id) {
                res.status(422).json({
                    message: 'You cannot change your own role.',
                    errors: { role: 'You cannot change your own role.' },
                });
                return;
            }

            const user = isValidObjectId(id)
                ? await User.findByIdAndUpdate(
                      id,
                      { $set: { role: input.role } },
                      { returnDocument: 'after' },
                  ).lean()
                : null;
            if (!user) {
                res.status(404).json({ message: 'User not found.' });
                return;
            }

            res.json({ user: toUserDTO(user) });
        },
    );

    return router;
}
