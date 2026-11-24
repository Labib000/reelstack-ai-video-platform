import {
    type AuthResponse,
    loginSchema,
    registerSchema,
} from '@reelstack/shared';
import { type Request, type Response, Router } from 'express';

import {
    clearRefreshCookie,
    readRefreshCookie,
    setRefreshCookie,
} from '../auth/cookies.js';
import {
    getDummyHash,
    hashPassword,
    verifyPassword,
} from '../auth/password.js';
import {
    type ClientContext,
    type IssuedTokens,
    InvalidRefreshError,
    RefreshService,
} from '../auth/refreshService.js';
import type { Config } from '../config.js';
import type { Logger } from '../lib/logger.js';
import { loginLimiter, perIpLimiter } from '../middleware/rateLimits.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireCsrfHeader } from '../middleware/requireCsrfHeader.js';
import { parseOr422, sendValidationErrors } from '../middleware/validate.js';
import { User, toUserDTO } from '../models/User.js';

const HOUR_MS = 3_600_000;

function clientContext(req: Request): ClientContext {
    return {
        userAgent: req.get('user-agent')?.slice(0, 256) ?? null,
        ip: req.ip ?? null,
    };
}

const isDuplicateKey = (error: unknown) =>
    (error as { code?: number } | null)?.code === 11000;

export function createAuthRouter(config: Config, logger: Logger): Router {
    const router = Router();
    const sessions = new RefreshService(config, logger);
    const auth = requireAuth(config);

    /** Sets the cookie and sends `{ accessToken, user }`. */
    async function sendTokens(
        res: Response,
        tokens: IssuedTokens,
        status = 200,
    ): Promise<void> {
        const user = await User.findById(tokens.userId).lean();
        if (!user) throw new Error('User vanished while issuing tokens');

        setRefreshCookie(res, tokens.refreshToken, config);
        const body: AuthResponse = {
            accessToken: tokens.accessToken,
            user: toUserDTO(user),
        };
        res.status(status).json(body);
    }

    router.post(
        '/register',
        perIpLimiter('register', 5, HOUR_MS),
        async (req, res) => {
            const input = parseOr422(registerSchema, req.body, res);
            if (!input) return;

            const emailTaken = () =>
                sendValidationErrors(res, {
                    email: 'An account with this email already exists.',
                });

            if (await User.exists({ email: input.email })) {
                emailTaken();
                return;
            }

            let user;
            try {
                user = await User.create({
                    name: input.name,
                    email: input.email,
                    passwordHash: await hashPassword(input.password),
                });
            } catch (error) {
                // Two registrations with the same email at once.
                if (isDuplicateKey(error)) {
                    emailTaken();
                    return;
                }
                throw error;
            }

            const tokens = await sessions.issueSession(user, clientContext(req));
            await sendTokens(res, tokens, 201);
        },
    );

    router.post('/login', loginLimiter(), async (req, res) => {
        const input = parseOr422(loginSchema, req.body, res);
        if (!input) return;

        const user = await User.findOne({ email: input.email })
            .select('+passwordHash role tokenVersion')
            .lean();

        // Verify even when the user is missing, so both cases take as long.
        const ok = await verifyPassword(
            user?.passwordHash ?? (await getDummyHash()),
            input.password,
        );

        if (!user || !ok) {
            res.status(401).json({ message: 'Invalid email or password.' });
            return;
        }

        const tokens = await sessions.issueSession(user, clientContext(req));
        await sendTokens(res, tokens);
    });

    router.post(
        '/refresh',
        requireCsrfHeader,
        perIpLimiter('refresh', 30, 60_000),
        async (req, res) => {
            const raw = readRefreshCookie(req);
            if (!raw) {
                res.status(401).json({ message: 'No refresh token.' });
                return;
            }

            try {
                const tokens = await sessions.rotate(raw, clientContext(req));
                await sendTokens(res, tokens);
            } catch (error) {
                if (!(error instanceof InvalidRefreshError)) throw error;
                clearRefreshCookie(res, config);
                res.status(401).json({ message: 'Session expired. Please log in again.' });
            }
        },
    );

    /** Signs this device out. Needs only the cookie, so it works after the access token expired. */
    router.post('/logout', requireCsrfHeader, async (req, res) => {
        const raw = readRefreshCookie(req);
        if (raw) await sessions.revokeByToken(raw, 'logout');
        clearRefreshCookie(res, config);
        res.status(204).end();
    });

    router.post('/logout-all', auth, async (req, res) => {
        await sessions.revokeAllForUser(req.user!.id);
        clearRefreshCookie(res, config);
        res.status(204).end();
    });

    router.get('/me', auth, async (req, res) => {
        const user = await User.findById(req.user!.id).lean();
        if (!user) {
            res.status(401).json({ message: 'Unauthenticated.' });
            return;
        }
        res.json({ user: toUserDTO(user) });
    });

    router.get('/sessions', auth, async (req, res) => {
        const current = await sessions.familyOf(readRefreshCookie(req));
        res.json({ sessions: await sessions.listSessions(req.user!.id, current) });
    });

    router.delete('/sessions/:familyId', auth, async (req, res) => {
        const { familyId } = req.params as { familyId: string };
        if (!(await sessions.familyBelongsTo(familyId, req.user!.id))) {
            res.status(404).json({ message: 'Session not found.' });
            return;
        }
        await sessions.revokeFamily(familyId, 'session-revoked', req.user!.id);
        res.status(204).end();
    });

    return router;
}
