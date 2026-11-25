import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { createLogger } from '../src/lib/logger.js';
import { MemoryJobs } from '../src/lib/queue.js';
import { MemoryStorage } from '../src/lib/storage.js';
import { cleanupStaleUploads, evaluateProbe, ffprobeArgs, markProbeGaveUp, probeVideo, requeueLostProbes } from '../src/media/probe.js';
import { Video } from '../src/models/Video.js';
import { testConfig, useTestApp } from './support/app.js';

useTestApp();
const logger = createLogger(testConfig());
const stream = { codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080 };

describe('evaluateProbe', () => {
    it('accepts a normal video and rounds its duration', () => {
        expect(evaluateProbe({ streams: [stream], format: { duration: '125.6' } })).toEqual({
            ok: true,
            durationSec: 126,
            width: 1920,
            height: 1080,
            videoCodec: 'h264',
        });
    });

    it('rejects files without a video stream, unreadable files and bad lengths', () => {
        expect(evaluateProbe({ streams: [{ codec_type: 'audio' }], format: { duration: '60' } }).ok).toBe(false);
        expect(evaluateProbe(null).ok).toBe(false);
        expect(evaluateProbe({ streams: [stream], format: { duration: '0.2' } }).ok).toBe(false);
        expect(evaluateProbe({ streams: [stream], format: { duration: String(7 * 3600) } })).toEqual({
            ok: false,
            error: 'Videos can be up to 6 hours long.',
        });
    });
});

const baseVideo = () => ({
    owner: new Types.ObjectId(),
    title: 't',
    sourceKey: 'uploads/x/source.mp4',
    partSize: 1,
    sizeBytes: 1,
    contentType: 'video/mp4',
});

describe('probeVideo', () => {
    it('saves metadata on success and the reason on failure', async () => {
        const storage = new MemoryStorage();
        storage.objects.set('uploads/x/source.mp4', 1);
        const good = await Video.create({ ...baseVideo(), status: 'processing' });
        await probeVideo(good.id, storage, logger, async () => ({ streams: [stream], format: { duration: '61' } }));
        expect(await Video.findById(good.id).lean()).toMatchObject({ status: 'processing', durationSec: 61, width: 1920 });

        const bad = await Video.create({ ...baseVideo(), status: 'processing' });
        await probeVideo(bad.id, storage, logger, async () => null);
        expect(await Video.findById(bad.id).lean()).toMatchObject({ status: 'failed', error: 'This file isn’t a playable video.' });
    });

    it('fails a missing file, but throws (so the job retries) when storage is down', async () => {
        const storage = new MemoryStorage();
        const v = await Video.create({ ...baseVideo(), status: 'processing' });
        storage.head = async () => {
            throw new Error('storage down');
        };
        await expect(probeVideo(v.id, storage, logger, async () => null)).rejects.toThrow('storage down');
        expect((await Video.findById(v.id).lean())!.status).toBe('processing');

        await probeVideo(v.id, new MemoryStorage(), logger, async () => null);
        expect((await Video.findById(v.id).lean())!.error).toMatch(/missing/);
    });

    it('gives up and re-queues only unchecked videos', async () => {
        const v = await Video.create({ ...baseVideo(), status: 'processing' });
        const checked = await Video.create({ ...baseVideo(), status: 'processing', processedAt: new Date() });
        const jobs = new MemoryJobs();
        expect(await requeueLostProbes(jobs)).toBe(0); // too recent
        expect(await requeueLostProbes(jobs, -1000)).toBe(1);
        expect(jobs.probes).toEqual([v.id]);

        await markProbeGaveUp(v.id);
        await markProbeGaveUp(checked.id);
        expect((await Video.findById(v.id).lean())!.status).toBe('failed');
        expect((await Video.findById(checked.id).lean())!.status).toBe('processing');
    });

    it('restricts ffprobe to plain containers over HTTP', () => {
        const args = ffprobeArgs('http://x');
        expect(args[args.indexOf('-protocol_whitelist') + 1]).not.toContain('file');
        expect(args[args.indexOf('-format_whitelist') + 1]).not.toMatch(/hls|concat|dash/);
    });

    it('skips videos that were deleted or are not processing', async () => {
        const v = await Video.create({ ...baseVideo(), status: 'uploading' });
        expect(await probeVideo(v.id, new MemoryStorage(), logger, async () => null)).toBeNull();
    });
});

describe('cleanupStaleUploads', () => {
    it('aborts uploads older than a day and keeps recent ones', async () => {
        const storage = new MemoryStorage();
        const oldId = await storage.createMultipart('uploads/old/source.mp4', 'video/mp4');
        const old = await Video.create({ ...baseVideo(), uploadId: oldId });
        await Video.collection.updateOne({ _id: old._id }, { $set: { createdAt: new Date(Date.now() - 25 * 3_600_000) } });
        await Video.create({ ...baseVideo(), uploadId: 'recent' });

        expect(await cleanupStaleUploads(storage, logger)).toBe(1);
        expect(storage.uploads.size).toBe(0);
        expect(await Video.countDocuments()).toBe(1);
    });
});
