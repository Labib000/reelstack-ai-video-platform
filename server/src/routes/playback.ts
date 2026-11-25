import { type Role, type Visibility, type WatchVideoDTO, can } from '@reelstack/shared';
import { type Response, Router } from 'express';
import { type Types, isValidObjectId } from 'mongoose';

import { playbackTtlSec, signPlaybackToken, verifyPlaybackToken } from '../auth/playbackToken.js';
import type { Config } from '../config.js';
import type { Storage } from '../lib/storage.js';
import { optionalAuth } from '../middleware/requireAuth.js';
import { User } from '../models/User.js';
import { Video, type VideoFields } from '../models/Video.js';

type Viewer = { id: string; role: Role } | null;

/** Public and unlisted: anyone. Private or removed: the owner and moderators. */
export function canWatch(video: Pick<VideoFields, 'visibility' | 'removedAt'> & { owner: Types.ObjectId }, viewer: Viewer): boolean {
    if (viewer && (video.owner.toString() === viewer.id || can(viewer.role, 'video:moderate'))) return true;
    return !video.removedAt && video.visibility !== 'private';
}

const isUri = (line: string) => line.trim() !== '' && !line.startsWith('#');

/** Variant links keep the token; everything else is FFmpeg's master playlist. */
export const rewriteMaster = (text: string, token: string) =>
    text
        .split('\n')
        .map((l) => (isUri(l) ? `${l.trim()}?token=${encodeURIComponent(token)}` : l))
        .join('\n');

/** Points the media file (init section and every byte range) at its signed URL. */
export const rewriteVariant = (text: string, signedUrl: string) =>
    text
        .split('\n')
        .map((l) => (isUri(l) ? signedUrl : l.replace(/URI="[^"]*"/, () => `URI="${signedUrl}"`)))
        .join('\n');

export function createPlaybackRouter(config: Config, storage: Storage): Router {
    const router = Router();
    const notFound = (res: Response) => void res.status(404).json({ message: 'Video not found.' });

    /** Not ready, not allowed and not there all look the same from outside. */
    async function watchable(id: string, viewer: Viewer) {
        const video = isValidObjectId(id) ? await Video.findById(id).lean() : null;
        return video && video.status === 'ready' && video.hlsPrefix && canWatch(video, viewer) ? video : null;
    }

    router.get('/videos/:id/watch', optionalAuth(config), async (req, res) => {
        const video = await watchable(req.params.id as string, req.user ?? null);
        if (!video) return notFound(res);
        const owner = await User.findById(video.owner).select('name username').lean();
        const id = video._id.toString();
        const token = signPlaybackToken(id, req.user?.id ?? null, playbackTtlSec(video.durationSec!), config);
        const body: { video: WatchVideoDTO } = {
            video: {
                id,
                title: video.title,
                description: video.description ?? '',
                visibility: video.visibility as Visibility,
                durationSec: video.durationSec!,
                width: video.width!,
                height: video.height!,
                views: video.views ?? 0,
                createdAt: video.createdAt.toISOString(),
                thumbnailUrl: video.thumbnailKey ? await storage.signStable(video.thumbnailKey) : null,
                owner: owner ? { id: owner._id.toString(), name: owner.name, username: owner.username ?? null } : null,
                isOwner: video.owner.toString() === req.user?.id,
                removedReason: video.removedReason ?? null,
                playbackUrl: `/api/playback/${id}/master.m3u8?token=${encodeURIComponent(token)}`,
            },
        };
        res.set('Cache-Control', 'no-store').json(body);
    });

    /** Token → viewer → video, re-read every time so a takedown or ban applies to the next request. */
    async function fromToken(id: string, token: unknown) {
        if (typeof token !== 'string') return null;
        let uid: string | null;
        try {
            uid = verifyPlaybackToken(token, id, config);
        } catch {
            return null;
        }
        let viewer: Viewer = null;
        if (uid) {
            const user = await User.findById(uid).select('role bannedAt').lean();
            if (!user || user.bannedAt) return null;
            viewer = { id: uid, role: user.role as Role };
        }
        return watchable(id, viewer);
    }

    const playlist = (res: Response, text: string) => void res.set('Cache-Control', 'no-store').type('application/vnd.apple.mpegurl').send(text);

    router.get('/playback/:id/master.m3u8', async (req, res) => {
        const video = await fromToken(req.params.id as string, req.query.token);
        if (!video) return notFound(res);
        playlist(res, rewriteMaster(await storage.getText(`${video.hlsPrefix}master.m3u8`), req.query.token as string));
    });

    router.get('/playback/:id/:file', async (req, res) => {
        const height = Number(/^(\d+)\.m3u8$/.exec(req.params.file as string)?.[1] ?? NaN);
        const video = await fromToken(req.params.id as string, req.query.token);
        if (!video || !video.renditions.includes(height)) return notFound(res);
        const [text, url] = await Promise.all([
            storage.getText(`${video.hlsPrefix}${height}.m3u8`),
            storage.signGet(`${video.hlsPrefix}${height}.m4s`, playbackTtlSec(video.durationSec!), false),
        ]);
        playlist(res, rewriteVariant(text, url));
    });

    return router;
}
