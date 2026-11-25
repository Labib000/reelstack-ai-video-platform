import {
    type AuthResponse,
    loginSchema,
    registerSchema,
    type UsernameAvailability,
    usernameSchema,
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
import { SUSPENDED, requireAuth } from '../middleware/requireAuth.js';
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

/** The unique field a duplicate-key error is about (`email` / `username`), or null. */
function duplicateField(error: unknown): string | null {
    const e = error as { code?: number; keyPattern?: Record<string, unknown> } | null;
    if (e?.code !== 11000) return null;
    return Object.keys(e.keyPattern ?? {})[0] ?? 'email';
}

const TAKEN: Record<string, string> = {
    email: 'An account with this email already exists.',
    username: 'That username is taken.',
};

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

            const [emailUsed, usernameUsed] = await Promise.all([
                User.exists({ email: input.email }),
                User.exists({ username: input.username }),
            ]);
            if (emailUsed || usernameUsed) {
                sendValidationErrors(res, {
                    ...(emailUsed && { email: TAKEN.email! }),
                    ...(usernameUsed && { username: TAKEN.username! }),
                });
                return;
            }

            let user;
            try {
                user = await User.create({
                    name: input.name,
                    username: input.username,
                    email: input.email,
                    passwordHash: await hashPassword(input.password),
                    dateOfBirth: new Date(`${input.dateOfBirth}T00:00:00Z`),
                    interests: input.interests,
                    termsAcceptedAt: new Date(),
                    marketingOptIn: input.marketingOptIn ?? false,
                    lastLoginAt: new Date(),
                });
            } catch (error) {
                // Two registrations with the same email or username at once.
                const field = duplicateField(error);
                if (field) {
                    sendValidationErrors(res, { [field]: TAKEN[field] ?? 'Already taken.' });
                    return;
                }
                throw error;
            }

            const tokens = await sessions.issueSession(user, clientContext(req));
            await sendTokens(res, tokens, 201);
        },
    );

    /**
     * Live check for the signup form. Usernames are public handles, so this
     * reveals nothing private (unlike an email check, which we don't offer).
     */
    router.get(
        '/username-available',
        perIpLimiter('username-check', 60, HOUR_MS),
        async (req, res) => {
            const parsed = usernameSchema.safeParse(req.query.username);
            let body: UsernameAvailability;
            if (!parsed.success) {
                body = { available: false, reason: parsed.error.issues[0]?.message ?? 'Invalid username' };
            } else if (await User.exists({ username: parsed.data })) {
                body = { available: false, reason: TAKEN.username };
            } else {
                body = { available: true };
            }
            res.json(body);
        },
    );

    router.post('/login', loginLimiter(), async (req, res) => {
        const input = parseOr422(loginSchema, req.body, res);
        if (!input) return;

        const user = await User.findOne({ email: input.email })
            .select('+passwordHash role tokenVersion bannedAt')
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
        // Only after the password checks out, so this doesn't reveal accounts.
        if (user.bannedAt) {
            res.status(403).json({ message: SUSPENDED });
            return;
        }
        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

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
