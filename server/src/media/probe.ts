/**
 * The file check that runs after an upload: is this really a video, and
 * how long / how big is it? ffprobe reads the file over a presigned URL
 * (HTTP range requests), so nothing is downloaded in full.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { Jobs } from '../lib/queue.js';
import type { Logger } from '../lib/logger.js';
import type { Storage } from '../lib/storage.js';
import { Video } from '../models/Video.js';

const run = promisify(execFile);

export const PROBE_LIMITS = { minSec: 1, maxSec: 6 * 3600 } as const;

interface FfprobeOutput {
    streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string }[];
    format?: { duration?: string };
}

export type ProbeVerdict =
    | { ok: true; durationSec: number; width: number; height: number; videoCodec: string | null }
    | { ok: false; error: string };

/** Pure: turn ffprobe's JSON into a verdict (unit-tested without ffprobe). */
export function evaluateProbe(output: FfprobeOutput | null): ProbeVerdict {
    const video = output?.streams?.find((s) => s.codec_type === 'video' && s.width && s.height);
    if (!output || !video) return { ok: false, error: 'This file isn’t a playable video.' };
    const duration = Number(output.format?.duration ?? video.duration);
    if (!Number.isFinite(duration) || duration < PROBE_LIMITS.minSec) {
        return { ok: false, error: 'This video is too short (or its length can’t be read).' };
    }
    if (duration > PROBE_LIMITS.maxSec) return { ok: false, error: 'Videos can be up to 6 hours long.' };
    return { ok: true, durationSec: Math.round(duration), width: video.width!, height: video.height!, videoCodec: video.codec_name ?? null };
}

export type Ffprobe = (url: string) => Promise<FfprobeOutput | null>;

/**
 * Uploads are untrusted. Playlist formats (HLS, DASH, concat) can point ffprobe
 * at other URLs or local files, so only plain containers over HTTP are allowed.
 */
export const ffprobeArgs = (url: string) => [
    '-v', 'error',
    '-protocol_whitelist', 'http,https,tcp,tls',
    '-format_whitelist', 'mov,mp4,m4a,3gp,3g2,mj2,matroska,webm,avi',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    url,
];

/** Runs the real ffprobe binary; null when it can't make sense of the input. */
export const ffprobe: Ffprobe = async (url) => {
    try {
        const { stdout } = await run('ffprobe', ffprobeArgs(url), {
            timeout: 60_000,
            maxBuffer: 4 * 1024 * 1024,
        });
        return JSON.parse(stdout) as FfprobeOutput;
    } catch (error) {
        const e = error as { code?: string | number; killed?: boolean };
        // Missing binary or a timeout is our problem, not the file's: let BullMQ retry.
        if (e.code === 'ENOENT' || e.killed) throw error;
        return null;
    }
};

/** Probe one video and record the result. Leaves status `processing` on success (transcode is Phase 3). */
export async function probeVideo(videoId: string, storage: Storage, logger: Logger, probe: Ffprobe = ffprobe): Promise<ProbeVerdict | null> {
    const video = await Video.findById(videoId).lean();
    if (!video || video.status !== 'processing') return null; // deleted or already handled
    // head() throws when storage is down, so the job retries instead of blaming the file.
    let verdict: ProbeVerdict;
    if ((await storage.head(video.sourceKey)) === null) {
        verdict = { ok: false, error: 'The uploaded file is missing. Please upload it again.' };
    } else {
        const output = await probe(await storage.signGet(video.sourceKey));
        // Unreadable: make sure that wasn't storage dropping out mid-read.
        if (output === null) await storage.head(video.sourceKey);
        verdict = evaluateProbe(output);
    }
    if (verdict.ok) {
        const { ok: _ok, ...meta } = verdict;
        await Video.updateOne({ _id: video._id }, { $set: { ...meta, error: null, processedAt: new Date() } });
        logger.info({ videoId, ...meta }, 'Probe passed');
    } else {
        await Video.updateOne({ _id: video._id }, { $set: { status: 'failed', error: verdict.error, processedAt: new Date() } });
        logger.info({ videoId, error: verdict.error }, 'Probe rejected the file');
    }
    return verdict;
}

/** Abort uploads nobody finished within `maxAgeMs`, and forget them. */
export async function cleanupStaleUploads(storage: Storage, logger: Logger, maxAgeMs = 24 * 3_600_000): Promise<number> {
    const stale = await Video.find({ status: 'uploading', createdAt: { $lt: new Date(Date.now() - maxAgeMs) } }).lean();
    for (const v of stale) {
        if (v.uploadId) await storage.abort(v.sourceKey, v.uploadId);
        await Video.deleteOne({ _id: v._id });
    }
    if (stale.length) logger.info({ count: stale.length }, 'Aborted stale uploads');
    return stale.length;
}

/** Retries ran out: say so, rather than leaving the video in "Checking" forever. */
export async function markProbeGaveUp(videoId: string): Promise<void> {
    await Video.updateOne(
        { _id: videoId, status: 'processing', processedAt: null },
        { $set: { status: 'failed', error: 'We couldn’t check this file. A moderator can run the check again.' } },
    );
}

/** Re-queue videos whose probe job was lost (e.g. Redis was down on completion). */
export async function requeueLostProbes(jobs: Jobs, minAgeMs = 30 * 60_000): Promise<number> {
    const lost = await Video.find({ status: 'processing', processedAt: null, updatedAt: { $lt: new Date(Date.now() - minAgeMs) } }, '_id').lean();
    for (const v of lost) await jobs.enqueueProbe(v._id.toString());
    return lost.length;
}
