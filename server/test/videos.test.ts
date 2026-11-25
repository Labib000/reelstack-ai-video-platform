import { UPLOAD_LIMITS } from '@reelstack/shared';
import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { Video } from '../src/models/Video.js';
import { partSizeFor } from '../src/routes/videos.js';
import { registerUser, useTestApp } from './support/app.js';

const { app, storage, jobs } = useTestApp();
const MB = 1024 * 1024;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const upload = (overrides: object = {}) => ({
    fileName: 'talk.mp4',
    sizeBytes: 25 * MB,
    contentType: 'video/mp4',
    title: 'My talk',
    ...overrides,
});

async function startUpload(token: string, overrides: object = {}) {
    const res = await request(app).post('/api/videos').set(auth(token)).send(upload(overrides));
    expect(res.status).toBe(201);
    return res.body as { video: { id: string }; partSize: number; partCount: number };
}

/** Pretend the browser uploaded every part, then finish. */
async function finish(token: string, id: string, partCount: number, size: number | null = null) {
    const video = await Video.findById(id).lean();
    storage.nextSize.set(video!.sourceKey, size ?? video!.sizeBytes);
    const parts = Array.from({ length: partCount }, (_, i) => ({ partNumber: i + 1, etag: `"etag-${i + 1}"` }));
    return request(app).post(`/api/videos/${id}/complete`).set(auth(token)).send({ parts });
}

describe('partSizeFor', () => {
    it('uses 10 MB parts and grows them for files that would need over 10 000 parts', () => {
        expect(partSizeFor(25 * MB)).toBe(10 * MB);
        expect(Math.ceil((200 * 1024 * MB) / partSizeFor(200 * 1024 * MB))).toBeLessThanOrEqual(10_000);
    });
});

describe('POST /api/videos', () => {
    it('needs a signed-in user', async () => {
        expect((await request(app).post('/api/videos').send(upload())).status).toBe(401);
    });

    it('rejects files that are not videos or are too big', async () => {
        const { accessToken } = await registerUser(app);
        const notVideo = await request(app).post('/api/videos').set(auth(accessToken)).send(upload({ contentType: 'image/png' }));
        expect(notVideo.status).toBe(422);
        const tooBig = await request(app).post('/api/videos').set(auth(accessToken)).send(upload({ sizeBytes: UPLOAD_LIMITS.maxBytes + 1 }));
        expect(tooBig.status).toBe(422);
    });

    it('opens a multipart upload and returns the part plan', async () => {
        const { accessToken, userId } = await registerUser(app);
        const session = await startUpload(accessToken);
        expect(session.partSize).toBe(10 * MB);
        expect(session.partCount).toBe(3);
        const video = await Video.findById(session.video.id).lean();
        expect(video).toMatchObject({ status: 'uploading', title: 'My talk' });
        expect(video!.owner.toString()).toBe(userId);
        expect(video!.sourceKey).toBe(`uploads/${session.video.id}/source.mp4`);
        expect(storage.uploads.has(video!.uploadId!)).toBe(true);
    });

    it(`allows ${UPLOAD_LIMITS.maxInProgress} uploads in progress at once`, async () => {
        const { accessToken } = await registerUser(app);
        for (let i = 0; i < UPLOAD_LIMITS.maxInProgress; i++) await startUpload(accessToken);
        const res = await request(app).post('/api/videos').set(auth(accessToken)).send(upload());
        expect(res.status).toBe(429);
        expect(res.body.message).toMatch(/in progress/);
    });

    it(`allows ${UPLOAD_LIMITS.maxPerDay} uploads a day, even if they are deleted`, async () => {
        const { accessToken } = await registerUser(app);
        for (let i = 0; i < UPLOAD_LIMITS.maxPerDay; i++) {
            const { video } = await startUpload(accessToken);
            await request(app).delete(`/api/videos/${video.id}/upload`).set(auth(accessToken));
        }
        const res = await request(app).post('/api/videos').set(auth(accessToken)).send(upload());
        expect(res.status).toBe(429);
        expect(res.body.message).toMatch(/today/);
        expect(await Video.countDocuments()).toBe(0);
    });

    it('parallel requests cannot exceed the in-progress limit', async () => {
        const { accessToken } = await registerUser(app);
        await Promise.all(Array.from({ length: 6 }, () => request(app).post('/api/videos').set(auth(accessToken)).send(upload())));
        expect(await Video.countDocuments()).toBeLessThanOrEqual(UPLOAD_LIMITS.maxInProgress);
        expect(storage.uploads.size).toBe(await Video.countDocuments());
    });

    it('leaves nothing behind when storage refuses the upload', async () => {
        const { accessToken } = await registerUser(app);
        const spy = vi.spyOn(storage, 'createMultipart').mockRejectedValueOnce(new Error('down'));
        expect((await request(app).post('/api/videos').set(auth(accessToken)).send(upload())).status).toBe(500);
        expect(await Video.countDocuments()).toBe(0);
        spy.mockRestore();
    });
});

describe('uploading parts and completing', () => {
    it('signs part URLs only for the owner and only for real part numbers', async () => {
        const owner = await registerUser(app);
        const other = await registerUser(app);
        const { video } = await startUpload(owner.accessToken);

        const ok = await request(app).post(`/api/videos/${video.id}/parts`).set(auth(owner.accessToken)).send({ partNumbers: [1, 2, 3] });
        expect(ok.status).toBe(200);
        expect(ok.body.parts).toHaveLength(3);
        expect(ok.body.parts[0].url).toContain('partNumber=1');

        const tooMany = await request(app).post(`/api/videos/${video.id}/parts`).set(auth(owner.accessToken)).send({ partNumbers: [4] });
        expect(tooMany.status).toBe(422);
        const notMine = await request(app).post(`/api/videos/${video.id}/parts`).set(auth(other.accessToken)).send({ partNumbers: [1] });
        expect(notMine.status).toBe(404);
    });

    it('completes, moves to processing and queues the probe', async () => {
        const { accessToken } = await registerUser(app);
        const { video, partCount } = await startUpload(accessToken);
        const res = await finish(accessToken, video.id, partCount);
        expect(res.status).toBe(200);
        expect(res.body.video.status).toBe('processing');
        expect(jobs.probes).toEqual([video.id]);
        expect((await Video.findById(video.id).lean())!.uploadId).toBeNull();

        // Completing again is refused.
        expect((await finish(accessToken, video.id, partCount)).status).toBe(409);
    });

    it('only one of two simultaneous completes wins', async () => {
        const { accessToken } = await registerUser(app);
        const { video, partCount } = await startUpload(accessToken);
        const results = await Promise.all([finish(accessToken, video.id, partCount), finish(accessToken, video.id, partCount)]);
        expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
        expect(jobs.probes).toEqual([video.id]);
    });

    it('can be completed again after storage fails to assemble it', async () => {
        const { accessToken } = await registerUser(app);
        const { video, partCount } = await startUpload(accessToken);
        const spy = vi.spyOn(storage, 'complete').mockRejectedValueOnce(new Error('down'));
        expect((await finish(accessToken, video.id, partCount)).status).toBe(422);
        spy.mockRestore();
        expect((await finish(accessToken, video.id, partCount)).status).toBe(200);
    });

    it('still succeeds when the queue is down', async () => {
        const { accessToken } = await registerUser(app);
        const { video, partCount } = await startUpload(accessToken);
        const spy = vi.spyOn(jobs, 'enqueueProbe').mockRejectedValueOnce(new Error('redis down'));
        expect((await finish(accessToken, video.id, partCount)).status).toBe(200);
        spy.mockRestore();
    });

    it('refuses to complete with missing parts', async () => {
        const { accessToken } = await registerUser(app);
        const { video } = await startUpload(accessToken);
        const res = await finish(accessToken, video.id, 2);
        expect(res.status).toBe(422);
        expect((await Video.findById(video.id).lean())!.status).toBe('uploading');
        expect(jobs.probes).toEqual([]);
    });

    it('fails the video when storage has a different size than claimed', async () => {
        const { accessToken } = await registerUser(app);
        const { video, partCount } = await startUpload(accessToken);
        const res = await finish(accessToken, video.id, partCount, 5 * MB);
        expect(res.status).toBe(422);
        const stored = await Video.findById(video.id).lean();
        expect(stored!.status).toBe('failed');
        expect(storage.objects.size).toBe(0);
        expect(jobs.probes).toEqual([]);
    });

    it('cancelling aborts the upload and forgets the video', async () => {
        const { accessToken } = await registerUser(app);
        const { video } = await startUpload(accessToken);
        expect((await request(app).delete(`/api/videos/${video.id}/upload`).set(auth(accessToken))).status).toBe(204);
        expect(await Video.countDocuments()).toBe(0);
        expect(storage.uploads.size).toBe(0);
    });
});

describe('your videos', () => {
    it('lists only your own, newest first', async () => {
        const me = await registerUser(app);
        const other = await registerUser(app);
        await startUpload(me.accessToken, { title: 'First' });
        await startUpload(me.accessToken, { title: 'Second' });
        await startUpload(other.accessToken, { title: 'Not mine' });
        const res = await request(app).get('/api/videos/mine').set(auth(me.accessToken));
        expect(res.body.videos.map((v: { title: string }) => v.title)).toEqual(['Second', 'First']);
    });

    it('lets only the owner edit and delete; deleting removes the files', async () => {
        const owner = await registerUser(app);
        const other = await registerUser(app);
        const { video, partCount } = await startUpload(owner.accessToken);
        await finish(owner.accessToken, video.id, partCount);

        const edit = { title: 'Renamed', visibility: 'unlisted' };
        expect((await request(app).patch(`/api/videos/${video.id}`).set(auth(other.accessToken)).send(edit)).status).toBe(404);
        const edited = await request(app).patch(`/api/videos/${video.id}`).set(auth(owner.accessToken)).send(edit);
        expect(edited.body.video).toMatchObject(edit);
        expect((await request(app).patch(`/api/videos/${video.id}`).set(auth(owner.accessToken)).send({})).status).toBe(422);

        expect((await request(app).delete(`/api/videos/${video.id}`).set(auth(other.accessToken))).status).toBe(404);
        expect(storage.objects.size).toBe(1);
        expect((await request(app).delete(`/api/videos/${video.id}`).set(auth(owner.accessToken))).status).toBe(204);
        expect(storage.objects.size).toBe(0);
        expect(await Video.countDocuments()).toBe(0);
    });

    it('returns 404 for bad ids', async () => {
        const { accessToken } = await registerUser(app);
        expect((await request(app).get('/api/videos/not-an-id').set(auth(accessToken))).status).toBe(404);
        expect((await request(app).get(`/api/videos/${new Types.ObjectId()}`).set(auth(accessToken))).status).toBe(404);
    });
});
