import type { CookieOptions, Request, Response } from 'express';

import type { Config } from '../config.js';

export const REFRESH_COOKIE = 'rs_refresh';

/**
 * httpOnly: page JavaScript (and so XSS) can't read it.
 * sameSite strict: never sent on cross-site requests (CSRF).
 * path /api/auth: only sent to the auth routes, not with every API call.
 */
function baseOptions(config: Pick<Config, 'NODE_ENV'>): CookieOptions {
    return {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
    };
}

export function setRefreshCookie(
    res: Response,
    token: string,
    config: Pick<Config, 'NODE_ENV' | 'REFRESH_TOKEN_TTL_DAYS'>,
): void {
    res.cookie(REFRESH_COOKIE, token, {
        ...baseOptions(config),
        maxAge: config.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
    });
}

export function clearRefreshCookie(
    res: Response,
    config: Pick<Config, 'NODE_ENV'>,
): void {
    res.clearCookie(REFRESH_COOKIE, baseOptions(config));
}

export function readRefreshCookie(req: Request): string | undefined {
    const value: unknown = req.cookies?.[REFRESH_COOKIE];
    return typeof value === 'string' && value !== '' ? value : undefined;
}
