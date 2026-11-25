import type { Role } from '@reelstack/shared';
import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { playbackTtlSec, signPlaybackToken } from '../src/auth/playbackToken.js';
import { User } from '../src/models/User.js';
import { Video } from '../src/models/Video.js';
import { rewriteMaster, rewriteVariant } from '../src/routes/playback.js';
import { registerUser, useTestApp } from './support/app.js';

const { app, storage, config } = useTestApp();

const VARIANT = '#EXTM3U\n#EXT-X-MAP:URI="360.m4s",BYTERANGE="10@0"\n#EXTINF:6,\n#EXT-X-BYTERANGE:20@10\n360.m4s\n#EXT-X-ENDLIST\n';

async function ready(ownerId: string, over: object = {}) {
    const _id = new Types.ObjectId();
    const hlsPrefix = `hls/${_id}/run/`;
    storage.texts.set(`${hlsPrefix}master.m3u8`, '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\n360.m3u8\n');
    storage.texts.set(`${hlsPrefix}360.m3u8`, VARIANT);
    return Video.create({
        _id, owner: new Types.ObjectId(ownerId), title: 'Clip', status: 'ready', sourceKey: 's', partSize: 1, sizeBytes: 1, contentType: 'video/mp4',
        durationSec: 60, width: 640, height: 360, hlsPrefix, renditions: [360], ...over,
    });
}
async function user(role: Role = 'user') {
    const u = await registerUser(app);
    await User.updateOne({ _id: u.userId }, { $set: { role } });
    return u;
}
const watch = (id: string, token?: string) => {
    const r = request(app).get(`/api/videos/${id}/watch`);
    return token ? r.set('Authorization', `Bearer ${token}`) : r;
};

describe('playlist rewriting', () => {
    it('adds the token to variants and signs every media reference', () => {
        expect(rewriteMaster('#EXTM3U\n360.m3u8\n', 'a+b')).toBe('#EXTM3U\n360.m3u8?token=a%2Bb\n');
        const out = rewriteVariant(VARIANT, 'https://s/x?sig=$&1');
        expect(out).toContain('URI="https://s/x?sig=$&1",BYTERANGE="10@0"');
        expect(out).toContain('\nhttps://s/x?sig=$&1\n');
        expect(out).not.toContain('360.m4s');
    });
    it('bounds how long a link lasts', () => {
        expect([playbackTtlSec(60), playbackTtlSec(7200), playbackTtlSec(6 * 3600 + 9999)]).toEqual([3600, 14400, 43200]);
    });
});

describe('who can watch', () => {
    it('follows visibility, takedowns and roles', async () => {
        const [owner, other, mod] = [await user(), await user(), await user('moderator')];
        const cases: [object, number, number, number, number][] = [
            // anonymous, other, owner, moderator
            [{ visibility: 'public' }, 200, 200, 200, 200],
            [{ visibility: 'unlisted' }, 200, 200, 200, 200],
            [{ visibility: 'private' }, 404, 404, 200, 200],
            [{ visibility: 'public', removedAt: new Date() }, 404, 404, 200, 200],
            [{ status: 'processing' }, 404, 404, 404, 404],
        ];
        for (const [over, ...expected] of cases) {
            const v = await ready(owner.userId, over);
            const got = [];
            for (const t of [undefined, other.accessToken, owner.accessToken, mod.accessToken]) got.push((await watch(v.id, t)).status);
            expect(got, JSON.stringify(over)).toEqual(expected);
        }
        expect((await watch('nope')).status).toBe(404);
        const v = await ready(owner.userId);
        expect((await watch(v.id, 'garbage')).status).toBe(401);
        expect((await watch(v.id, owner.accessToken)).body.video.isOwner).toBe(true);
    });
});

describe('playlists', () => {
    it('play with the token and point media at signed storage', async () => {
        const owner = await user();
        const v = await ready(owner.userId, { visibility: 'private' });
        const { playbackUrl } = (await watch(v.id, owner.accessToken)).body.video;
        const master = await request(app).get(playbackUrl);
        expect(master.status).toBe(200);
        expect(master.headers['cache-control']).toBe('no-store');
        const variant = /360\.m3u8\S+/.exec(master.text)![0];
        const media = await request(app).get(`/api/playback/${v.id}/${variant}`);
        expect(media.text).toContain(`https://storage.test/hls/${v.id}/run/360.m4s?signed`);
        expect((await request(app).get(`/api/playback/${v.id}/${variant.replace('360', '720')}`)).status).toBe(404);
    });

    it('refuse missing, expired, wrong-video and access tokens', async () => {
        const owner = await user();
        const [a, b] = [await ready(owner.userId), await ready(owner.userId)];
        const get = (t?: string) => request(app).get(`/api/playback/${a.id}/master.m3u8${t ? `?token=${t}` : ''}`);
        expect((await get()).status).toBe(404);
        expect((await get(signPlaybackToken(a.id, null, -10, config))).status).toBe(404);
        expect((await get(signPlaybackToken(b.id, null, 60, config))).status).toBe(404);
        expect((await get(owner.accessToken)).status).toBe(404);
        expect((await get(signPlaybackToken(a.id, null, 60, config))).status).toBe(200);
        // ...and a playback token is no use as an access token.
        const asAccess = signPlaybackToken(owner.userId, owner.userId, 60, config);
        expect((await request(app).get('/api/videos/mine').set('Authorization', `Bearer ${asAccess}`)).status).toBe(401);
    });

    it('stop working when the video goes private, is removed, or the viewer is suspended', async () => {
        const [owner, other] = [await user(), await user()];
        const v = await ready(owner.userId);
        const { playbackUrl } = (await watch(v.id, other.accessToken)).body.video;
        const status = async () => (await request(app).get(playbackUrl)).status;
        expect(await status()).toBe(200);
        await Video.updateOne({ _id: v._id }, { $set: { visibility: 'private' } });
        expect(await status()).toBe(404);
        await Video.updateOne({ _id: v._id }, { $set: { visibility: 'public', removedAt: new Date() } });
        expect(await status()).toBe(404);
        await Video.updateOne({ _id: v._id }, { $set: { removedAt: null } });
        await User.updateOne({ _id: other.userId }, { $set: { bannedAt: new Date() } });
        expect(await status()).toBe(404);
    });
});
