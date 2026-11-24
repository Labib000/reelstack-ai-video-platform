import type { ApiErrorBody, Role } from '@reelstack/shared';
import type { RequestHandler, Response } from 'express';
import { isValidObjectId } from 'mongoose';

import { verifyAccessToken } from '../auth/tokens.js';
import type { Config } from '../config.js';
import { User } from '../models/User.js';

function unauthorized(res: Response, message = 'Unauthenticated.'): void {
    const body: ApiErrorBody = { message };
    res.status(401).json(body);
}

/**
 * Requires `Authorization: Bearer <access token>`. Besides the JWT checks it
 * compares the token's `tv` with the user's current tokenVersion, so
 * logout-all (and a deleted user) takes effect immediately.
 */
export function requireAuth(
    config: Pick<Config, 'JWT_ACCESS_SECRET'>,
): RequestHandler {
    return async (req, res, next) => {
        const header = req.get('authorization') ?? '';
        const [scheme, token] = header.split(' ');
        if (scheme?.toLowerCase() !== 'bearer' || !token) {
            unauthorized(res);
            return;
        }

        let claims;
        try {
            claims = verifyAccessToken(token, config.JWT_ACCESS_SECRET);
        } catch {
            unauthorized(res, 'Invalid or expired access token.');
            return;
        }

        if (!isValidObjectId(claims.sub)) {
            unauthorized(res, 'Invalid or expired access token.');
            return;
        }

        const user = await User.findById(claims.sub)
            .select('role tokenVersion')
            .lean();
        if (!user || user.tokenVersion !== claims.tv) {
            unauthorized(res, 'Session has been revoked.');
            return;
        }

        // The role comes from the database, not the token, so a promotion or
        // demotion applies on the very next request.
        req.user = { id: claims.sub, role: user.role as Role };
        next();
    };
}
