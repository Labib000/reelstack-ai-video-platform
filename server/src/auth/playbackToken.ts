import { createHmac } from 'node:crypto';

import jwt from 'jsonwebtoken';

import type { Config } from '../config.js';

const ISSUER = 'reelstack';
const AUDIENCE = 'reelstack-playback';

type Keys = Pick<Config, 'JWT_ACCESS_SECRET' | 'PLAYBACK_TOKEN_SECRET'>;
/** A different key from access tokens, so neither can stand in for the other. */
const secretOf = (c: Keys) => c.PLAYBACK_TOKEN_SECRET ?? createHmac('sha256', c.JWT_ACCESS_SECRET).update('playback').digest('hex');

/**
 * Goes in playlist URLs, because Safari's native HLS can't send headers. It
 * opens one video's playlists and nothing else.
 */
export function signPlaybackToken(videoId: string, viewerId: string | null, ttlSec: number, config: Keys): string {
    return jwt.sign(viewerId ? { uid: viewerId } : {}, secretOf(config), {
        algorithm: 'HS256',
        subject: videoId,
        issuer: ISSUER,
        audience: AUDIENCE,
        expiresIn: ttlSec,
    });
}

/** The viewer it was issued to (null = anonymous). Throws if it isn't valid for this video. */
export function verifyPlaybackToken(token: string, videoId: string, config: Keys): string | null {
    const payload = jwt.verify(token, secretOf(config), { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE, subject: videoId });
    if (typeof payload === 'string') throw new Error('Malformed playback token');
    return typeof payload.uid === 'string' ? payload.uid : null;
}

/** Long enough to watch with breaks: twice the duration, between 1 and 12 hours. */
export const playbackTtlSec = (durationSec: number) => Math.min(12 * 3600, Math.max(3600, durationSec * 2));
