/**
 * Turns a checked upload into adaptive HLS plus a thumbnail.
 *
 * Output goes to `hls/{videoId}/{runId}/` and only becomes visible when the
 * video is switched to it in one conditional update, so a retry, a deleted
 * video or a superseded run can never leave half a video playable.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readdir, rm, statfs } from 'node:fs/promises';
import { join } from 'node:path';

import type { Logger } from '../lib/logger.js';
import type { Storage } from '../lib/storage.js';
import { Video } from '../models/Video.js';
import { type RunFfmpeg, hlsArgs, runFfmpeg, thumbnailArgs } from './ffmpeg.js';
import { estimateBytes, ladderFor } from './ladder.js';

const PROGRESS_EVERY_MS = 2000;
const SPARE_BYTES = 1024 ** 3;

const TYPES: Record<string, string> = { m3u8: 'application/vnd.apple.mpegurl', m4s: 'video/mp4', jpg: 'image/jpeg' };
const typeOf = (file: string) => TYPES[file.split('.').pop() ?? ''] ?? 'application/octet-stream';

/** The video went away, or a newer run took over: stop quietly. */
class SupersededError extends Error {}

export interface TranscodeOptions {
    storage: Storage;
    logger: Logger;
    workDir: string;
    /** Aborts on worker shutdown. */
    signal?: AbortSignal;
    ffmpeg?: RunFfmpeg;
    progressEveryMs?: number;
}

export async function transcodeVideo(videoId: string, opts: TranscodeOptions): Promise<'ready' | 'skipped'> {
    const { storage, logger, workDir, ffmpeg = runFfmpeg, progressEveryMs = PROGRESS_EVERY_MS } = opts;
    const runId = randomUUID();
    const video = await Video.findOneAndUpdate(
        { _id: videoId, status: 'processing', processedAt: { $ne: null } },
        { $set: { transcodeRunId: runId, transcodeProgress: 0 } },
        { returnDocument: 'after' },
    ).lean();
    if (!video) return 'skipped'; // deleted, already done, or not checked yet

    const mine = { _id: video._id, transcodeRunId: runId, status: 'processing' as const };
    const renditions = ladderFor(video.width!, video.height!);
    const duration = video.durationSec!;
    const prefix = `hls/${videoId}/${runId}/`;
    const dir = join(workDir, runId);
    const out = join(dir, 'out');

    // One signal for "worker is stopping" and "this run no longer matters".
    const cancel = new AbortController();
    const signal = opts.signal ? AbortSignal.any([opts.signal, cancel.signal]) : cancel.signal;
    const touch = async (progress: number) => {
        const res = await Video.updateOne(mine, { $set: { transcodeProgress: progress } });
        if (res.matchedCount === 0) cancel.abort(new SupersededError('Video deleted or superseded'));
    };
    let progress = 0;
    let saving = false;
    // Saves even without FFmpeg news, so a delete during download or upload is noticed too.
    const ticker = setInterval(() => {
        if (saving) return;
        saving = true;
        touch(progress)
            .catch((err: unknown) => logger.warn({ err, videoId }, 'Could not save transcode progress'))
            .finally(() => (saving = false));
    }, progressEveryMs);

    try {
        await mkdir(out, { recursive: true });
        const { bavail, bsize } = await statfs(dir);
        const needed = video.sizeBytes + estimateBytes(renditions, duration) + SPARE_BYTES;
        if (bavail * bsize < needed) throw new Error(`Not enough disk space to transcode (need ${needed} bytes)`);

        const source = join(dir, 'source');
        await storage.downloadTo(video.sourceKey, source, signal);
        await ffmpeg(hlsArgs(source, out, renditions, video.hasAudio ?? false), {
            signal,
            onProgress: (sec) => {
                progress = Math.min(95, Math.floor((sec / duration) * 95)); // the rest is uploading
            },
        });

        let hasThumbnail = true;
        await ffmpeg(thumbnailArgs(source, join(out, 'thumb.jpg'), duration * 0.1), { signal, stallMs: 60_000 }).catch((err: unknown) => {
            signal.throwIfAborted();
            logger.warn({ err, videoId }, 'Thumbnail failed');
            hasThumbnail = false;
        });
        await rm(source, { force: true });

        const files = await readdir(out);
        if (hasThumbnail) hasThumbnail = files.includes('thumb.jpg');
        for (const [i, file] of files.entries()) {
            await storage.putFile(prefix + file, join(out, file), typeOf(file), signal);
            progress = 95 + Math.floor(((i + 1) / files.length) * 4);
        }

        const res = await Video.updateOne(mine, {
            $set: {
                status: 'ready',
                error: null,
                transcodeProgress: null,
                hlsPrefix: prefix,
                renditions: renditions.map((r) => r.name),
                thumbnailKey: hasThumbnail ? `${prefix}thumb.jpg` : null,
            },
        });
        if (res.matchedCount === 0) throw new SupersededError('Video deleted or superseded');
        logger.info({ videoId, renditions: renditions.map((r) => r.name) }, 'Transcode finished');
    } catch (error) {
        await storage.deletePrefix(prefix).catch((err: unknown) => logger.warn({ err, prefix }, 'Could not delete partial output'));
        if (error instanceof SupersededError || cancel.signal.aborted) {
            logger.info({ videoId }, 'Transcode stopped: video deleted or superseded');
            return 'skipped';
        }
        throw error;
    } finally {
        clearInterval(ticker);
        await rm(dir, { recursive: true, force: true });
    }

    // Output from earlier runs (reprocessing) is no longer needed.
    if (video.hlsPrefix && video.hlsPrefix !== prefix) {
        await storage.deletePrefix(video.hlsPrefix).catch((err: unknown) => logger.warn({ err, videoId }, 'Could not delete the previous output'));
    }
    return 'ready';
}

export async function markTranscodeGaveUp(videoId: string): Promise<void> {
    await Video.updateOne(
        { _id: videoId, status: 'processing', processedAt: { $ne: null } },
        { $set: { status: 'failed', transcodeProgress: null, error: 'We couldn’t convert this video. A moderator can try again.' } },
    );
}
