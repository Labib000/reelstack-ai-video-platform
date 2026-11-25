/**
 * Background worker: runs the media jobs the API queues (`npm run worker`).
 * A separate process so slow FFmpeg work never blocks API requests.
 */
import { Worker } from 'bullmq';

import { loadConfig } from './config.js';
import { connectMongo, disconnectMongo } from './db.js';
import { createLogger } from './lib/logger.js';
import { BullJobs, MEDIA_QUEUE, redisConnection } from './lib/queue.js';
import { S3Storage } from './lib/storage.js';
import { cleanupStaleUploads, markProbeGaveUp, probeVideo, requeueLostProbes } from './media/probe.js';

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
        if (job.name === 'probe') return probeVideo((job.data as { videoId: string }).videoId, storage, logger);
        if (job.name === 'cleanup') {
            await requeueLostProbes(jobs);
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

// Hourly sweep for abandoned uploads (upsert: one schedule however often we restart).
await jobs.scheduleCleanup();
logger.info('Worker ready');

async function shutdown(signal: string) {
    logger.info(`${signal} received, finishing current jobs`);
    await worker.close();
    await Promise.allSettled([jobs.close(), disconnectMongo()]);
    process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
