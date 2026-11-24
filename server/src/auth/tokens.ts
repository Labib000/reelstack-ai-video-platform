import { createHash, randomBytes } from 'node:crypto';

import type { Role } from '@reelstack/shared';
import jwt from 'jsonwebtoken';

const ISSUER = 'reelstack';
const AUDIENCE = 'reelstack-api';

/** What an access token carries. `tv` is the user's tokenVersion. */
export interface AccessClaims {
    sub: string;
    role: Role;
    tv: number;
}

export function signAccessToken(
    claims: AccessClaims,
    secret: string,
    ttlSec: number,
): string {
    return jwt.sign({ role: claims.role, tv: claims.tv }, secret, {
        algorithm: 'HS256',
        subject: claims.sub,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresIn: ttlSec,
    });
}

/**
 * Verifies signature, expiry, issuer and audience, and pins the algorithm so
 * a token signed with "none" or another algorithm is rejected. Throws on any
 * failure.
 */
export function verifyAccessToken(token: string, secret: string): AccessClaims {
    const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
    });

    if (
        typeof payload === 'string' ||
        typeof payload.sub !== 'string' ||
        (payload.role !== 'user' && payload.role !== 'admin') ||
        typeof payload.tv !== 'number'
    ) {
        throw new Error('Malformed access token');
    }

    return { sub: payload.sub, role: payload.role, tv: payload.tv };
}

/** 32 random bytes: an opaque refresh token (not a JWT, nothing to decode). */
export function generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 is enough here (no salt, no argon2): the token is 256 random bits,
 * so it can't be brute-forced the way a password can.
 */
export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}
