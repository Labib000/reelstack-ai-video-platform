import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLogger } from '../src/lib/logger.js';
import { MemoryJobs } from '../src/lib/queue.js';
import { MemoryStorage } from '../src/lib/storage.js';
import { type RunFfmpeg, hlsArgs, runFfmpeg, thumbnailArgs } from '../src/media/ffmpeg.js';
import { ladderFor } from '../src/media/ladder.js';
import { requeueLostTranscodes } from '../src/media/probe.js';
import { markTranscodeGaveUp, transcodeVideo } from '../src/media/transcode.js';
import { Video } from '../src/models/Video.js';
import { testConfig, useTestApp } from './support/app.js';

useTestApp();
const logger = createLogger(testConfig());
let workDir: string;
beforeAll(async () => {
    workDir = await mkdtemp(join(import.meta.dirname, '.transcode-'));
});
afterAll(() => rm(workDir, { recursive: true, force: true }));

const names = (w: number, h: number) => ladderFor(w, h).map((r) => r.name);

describe('ladderFor', () => {
    it('uses the short side and never upscales', () => {
        expect(names(1920, 1080)).toEqual([360, 720, 1080]);
        expect(names(3840, 2160)).toEqual([360, 720, 1080]);
        expect(names(1280, 720)).toEqual([360, 720]);
        expect(names(1080, 1920)).toEqual([360, 720, 1080]);
        expect(ladderFor(1080, 1920)[0]!.scale).toBe('360:-2');
        expect(ladderFor(1920, 1080)[0]!.scale).toBe('-2:360');
    });
    it('gives tiny and odd-sized sources one quality at their own size', () => {
        expect(names(426, 240)).toEqual([240]);
        expect(names(321, 181)).toEqual([180]);
    });
});

describe('ffmpeg arguments', () => {
    it('only reads local plain containers, and maps audio only when there is some', () => {
        const args = hlsArgs('/w/source', '/w/out', ladderFor(1280, 720), true);
        expect(args[args.indexOf('-protocol_whitelist') + 1]).toBe('file');
        expect(args.indexOf('-format_whitelist')).toBeLessThan(args.indexOf('-i'));
        expect(args).toContain('v:0,a:0,name:360 v:1,a:1,name:720');
        expect(hlsArgs('/w/source', '/w/out', ladderFor(1280, 720), false)).not.toContain('0:a:0');
        expect(thumbnailArgs('/w/source', '/w/t.jpg', 1)).toContain('-format_whitelist');
    });
});

const create = (over: object = {}) =>
    Video.create({
        owner: new Types.ObjectId(),
        title: 't',
        status: 'processing',
        sourceKey: 'uploads/x/source.mp4',
        partSize: 1,
        sizeBytes: 1,
        contentType: 'video/mp4',
        durationSec: 10,
        width: 1280,
        height: 720,
        processedAt: new Date(),
        ...over,
    });

/** Writes what FFmpeg would. */
const fake: RunFfmpeg = async (args, opts) => {
    const out = args.at(-1)!;
    if (out.endsWith('.jpg')) return writeFile(out, 'jpg');
    opts?.onProgress?.(5);
    for (const f of ['master.m3u8', '360.m3u8', '360.m4s', '720.m3u8', '720.m4s']) await writeFile(join(out, '..', f), f);
};
const run = (id: string, storage: MemoryStorage, ffmpeg: RunFfmpeg = fake, extra: object = {}) => transcodeVideo(id, { storage, logger, workDir, ffmpeg, ...extra });
const hlsKeys = (s: MemoryStorage) => [...s.objects.keys()].filter((k) => k.startsWith('hls/'));

describe('transcodeVideo', () => {
    it('publishes every file, then marks the video ready and cleans up', async () => {
        const storage = new MemoryStorage();
        const v = await create();
        expect(await run(v.id, storage)).toBe('ready');
        const saved = (await Video.findById(v.id).lean())!;
        expect(saved).toMatchObject({ status: 'ready', renditions: [360, 720], transcodeProgress: null });
        expect(saved.thumbnailKey).toBe(`${saved.hlsPrefix}thumb.jpg`);
        expect(hlsKeys(storage)).toHaveLength(6);
        expect(await readdir(workDir)).toEqual([]);
        expect(await run(v.id, storage)).toBe('skipped');
    });

    it('a thumbnail failure is not fatal', async () => {
        const v = await create();
        await run(v.id, new MemoryStorage(), async (a, o) => {
            if (a.at(-1)!.endsWith('.jpg')) throw new Error('no frame');
            return fake(a, o);
        });
        expect(await Video.findById(v.id).lean()).toMatchObject({ status: 'ready', thumbnailKey: null });
    });

    it('a failure leaves nothing behind, can be retried, and can be given up on', async () => {
        const storage = new MemoryStorage();
        const v = await create();
        storage.putFile = async (key) => {
            storage.objects.set(key, 1);
            if (key.endsWith('master.m3u8')) throw new Error('storage down');
        };
        await expect(run(v.id, storage)).rejects.toThrow('storage down');
        expect(hlsKeys(storage)).toEqual([]);
        expect(await readdir(workDir)).toEqual([]);
        expect(await run(v.id, new MemoryStorage())).toBe('ready');

        const other = await create();
        await markTranscodeGaveUp(other.id);
        expect((await Video.findById(other.id).lean())!.status).toBe('failed');
    });

    it('stops and cleans up when the video is deleted part-way', async () => {
        const storage = new MemoryStorage();
        const v = await create();
        const result = await run(
            v.id,
            storage,
            async (args, opts) => {
                if (args.at(-1)!.endsWith('.jpg')) return;
                await Video.deleteOne({ _id: v._id });
                await new Promise((_, reject) => opts!.signal!.addEventListener('abort', () => reject(opts!.signal!.reason as Error)));
            },
            { progressEveryMs: 20 },
        );
        expect(result).toBe('skipped');
        expect(hlsKeys(storage)).toEqual([]);
        expect(await readdir(workDir)).toEqual([]);
    });

    it('a superseded run cannot publish', async () => {
        const storage = new MemoryStorage();
        const v = await create();
        const result = await run(v.id, storage, async (a, o) => {
            await Video.updateOne({ _id: v._id }, { $set: { transcodeRunId: 'newer' } });
            return fake(a, o);
        });
        expect(result).toBe('skipped');
        expect((await Video.findById(v.id).lean())!.status).toBe('processing');
        expect(hlsKeys(storage)).toEqual([]);
    });

    it('a worker shutdown throws, so the job goes back in the queue', async () => {
        const stop = new AbortController();
        const v = await create();
        const p = run(v.id, new MemoryStorage(), async (_a, o) => {
            stop.abort(new Error('shutting down'));
            o!.signal!.throwIfAborted();
        }, { signal: stop.signal });
        await expect(p).rejects.toThrow('shutting down');
        expect((await Video.findById(v.id).lean())!.status).toBe('processing');
    });

    it('the sweep re-queues only stuck, checked videos, once', async () => {
        const v = await create();
        await create({ processedAt: null });
        const jobs = new MemoryJobs();
        expect(await requeueLostTranscodes(jobs)).toBe(0);
        await Video.collection.updateOne({ _id: v._id }, { $set: { updatedAt: new Date(Date.now() - 3_600_000) } });
        expect(await requeueLostTranscodes(jobs)).toBe(1);
        expect(await requeueLostTranscodes(jobs)).toBe(0);
        expect(jobs.transcodes).toEqual([v.id]);
    });
});

const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0;
describe.skipIf(!hasFfmpeg)('with real FFmpeg', () => {
    it('makes playable byte-range HLS from a portrait, silent clip', async () => {
        const src = join(workDir, 'src.mp4');
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=406x722:rate=24', '-t', '3', '-c:v', 'libx264', '-preset', 'ultrafast', src]);
        const storage = new MemoryStorage();
        storage.sourceFile = src;
        const v = await create({ width: 406, height: 722, durationSec: 3, hasAudio: false });
        expect(await run(v.id, storage, runFfmpeg)).toBe('ready');
        const { hlsPrefix, thumbnailKey } = (await Video.findById(v.id).lean())!;
        expect(storage.texts.get(`${hlsPrefix}master.m3u8`)).toContain('RESOLUTION=360x640');
        expect(storage.texts.get(`${hlsPrefix}360.m3u8`)).toMatch(/EXT-X-MAP:URI="360\.m4s",BYTERANGE/);
        expect(storage.objects.get(`${hlsPrefix}360.m4s`)).toBeGreaterThan(1000);
        expect(storage.objects.get(thumbnailKey!)).toBeGreaterThan(500);
        await rm(src);
    }, 30_000);

    it('kills a stalled process', async () => {
        const args = ['-v', 'error', '-re', '-f', 'lavfi', '-i', 'testsrc', '-t', '30', '-f', 'null', '-'];
        await expect(runFfmpeg(args, { stallMs: 200 })).rejects.toThrow('stopped making progress');
    });
});
