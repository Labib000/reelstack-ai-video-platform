/**
 * Background worker: runs the media jobs the API queues (`npm run worker`).
 * A separate process so slow FFmpeg work never blocks API requests.
 */
import { mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { DelayedError, Worker } from 'bullmq';

import { loadConfig } from './config.js';
import { connectMongo, disconnectMongo } from './db.js';
import { createLogger } from './lib/logger.js';
import { BullJobs, MEDIA_QUEUE, TRANSCODE_QUEUE, redisConnection } from './lib/queue.js';
import { S3Storage } from './lib/storage.js';
import { cleanupStaleUploads, markProbeGaveUp, probeVideo, requeueLostProbes, requeueLostTranscodes } from './media/probe.js';
import { markTranscodeGaveUp, transcodeVideo } from './media/transcode.js';

const config = loadConfig();
const logger = createLogger(config).child({ process: 'worker' });

if (!config.REDIS_URL) {
    logger.error('REDIS_URL is required to run the worker');
    process.exit(1);
}

await connectMongo(config.MONGO_URI, logger);
const storage = new S3Storage(config);
const connection = redisConnection(config.REDIS_URL);
const jobs = new BullJobs(config.REDIS_URL);

const worker = new Worker(
    MEDIA_QUEUE,
    async (job) => {
        if (job.name === 'probe') {
            const { videoId } = job.data as { videoId: string };
            const verdict = await probeVideo(videoId, storage, logger);
            if (verdict?.ok) await jobs.enqueueTranscode(videoId);
            return verdict;
        }
        if (job.name === 'cleanup') {
            await requeueLostProbes(jobs);
            await requeueLostTranscodes(jobs);
            return cleanupStaleUploads(storage, logger);
        }
        logger.warn({ name: job.name }, 'Unknown job');
    },
    { connection, concurrency: 2 },
);
worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, name: job?.name, err }, 'Job failed');
    if (job?.name === 'probe' && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        markProbeGaveUp((job.data as { videoId: string }).videoId).catch((error: unknown) => logger.error({ err: error }, 'Could not mark the video failed'));
    }
});

// One transcode at a time per worker: FFmpeg already uses every core.
const workDir = config.TRANSCODE_DIR ?? fileURLToPath(new URL('../../.transcode', import.meta.url));
const ownDir = `${workDir}/worker`;
await rm(ownDir, { recursive: true, force: true }); // left over from a crash
await mkdir(ownDir, { recursive: true });
const stopping = new AbortController();
const transcoder = new Worker(
    TRANSCODE_QUEUE,
    async (job, token) => {
        const { videoId } = job.data as { videoId: string };
        try {
            return await transcodeVideo(videoId, { storage, logger, workDir: ownDir, signal: stopping.signal });
        } catch (error) {
            if (!stopping.signal.aborted) throw error;
            // Shutting down isn't the video's fault: put it back without using up an attempt.
            await job.moveToDelayed(Date.now() + 1000, token);
            throw new DelayedError();
        }
    },
    { connection, concurrency: 1, maxStalledCount: 3 },
);
transcoder.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err }, 'Transcode failed');
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        markTranscodeGaveUp((job.data as { videoId: string }).videoId).catch((error: unknown) => logger.error({ err: error }, 'Could not mark the video failed'));
    }
});

// Hourly sweep for abandoned uploads (upsert: one schedule however often we restart).
await jobs.scheduleCleanup();
logger.info('Worker ready');

async function shutdown(signal: string) {
    logger.info(`${signal} received, finishing current jobs`);
    stopping.abort(new Error('Worker is shutting down'));
    await Promise.all([worker.close(), transcoder.close()]);
    await Promise.allSettled([jobs.close(), disconnectMongo()]);
    process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
