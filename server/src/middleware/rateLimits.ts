import type { ApiErrorBody } from '@reelstack/shared';
import type { Request, RequestHandler, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import { rateLimitStore } from '../lib/rateLimitStore.js';

const ip = (req: Request) => ipKeyGenerator(req.ip ?? 'unknown');

function tooMany(message: (seconds: number) => string, field?: string) {
    return (req: Request, res: Response) => {
        const resetTime = (
            req as Request & { rateLimit?: { resetTime?: Date } }
        ).rateLimit?.resetTime;
        const seconds = resetTime
            ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
            : 60;
        const text = message(seconds);
        const body: ApiErrorBody = field
            ? { message: text, errors: { [field]: text } }
            : { message: text };

        res.status(429).json(body);
    };
}

const common = {
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
};

/**
 * Login: 5 failed attempts a minute per email + IP. Successful logins are not
 * counted, so a user who types the password right isn't slowed down.
 */
export function loginLimiter(): RequestHandler {
    return rateLimit({
        ...common,
        windowMs: 60_000,
        limit: 5,
        store: rateLimitStore('login'),
        skipSuccessfulRequests: true,
        keyGenerator: (req) =>
            `${String(req.body?.email ?? '')
                .trim()
                .toLowerCase()}|${ip(req)}`,
        handler: tooMany(
            (s) => `Too many login attempts. Please try again in ${s} seconds.`,
            'email',
        ),
    });
}

/** Per-IP limiter for guest endpoints (register, refresh). */
export function perIpLimiter(
    name: string,
    limit: number,
    windowMs: number,
): RequestHandler {
    return rateLimit({
        ...common,
        windowMs,
        limit,
        store: rateLimitStore(name),
        keyGenerator: (req) => ip(req),
        handler: tooMany(
            (s) => `Too many attempts. Please try again in ${s} seconds.`,
        ),
    });
}
