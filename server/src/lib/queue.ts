/**
 * Background jobs on Redis (BullMQ). The API only enqueues; `src/worker.ts`
 * runs them: `probe` (is it a real video?), `transcode` (make HLS) and
 * `cleanup`. Transcodes have their own queue, so a long one never delays checks.
 */
import { Queue } from 'bullmq';

import type { Logger } from './logger.js';

export const MEDIA_QUEUE = 'media';
export const TRANSCODE_QUEUE = 'transcode';

export interface Jobs {
    enqueueProbe(videoId: string): Promise<void>;
    enqueueTranscode(videoId: string): Promise<void>;
    close(): Promise<void>;
}

/** BullMQ needs its own connection settings (it manages blocking clients itself). */
export function redisConnection(url: string) {
    const u = new URL(url);
    return {
        host: u.hostname,
        port: Number(u.port || 6379),
        username: u.username || undefined,
        password: u.password ? decodeURIComponent(u.password) : undefined,
        tls: u.protocol === 'rediss:' ? {} : undefined,
        maxRetriesPerRequest: null,
    };
}

export class BullJobs implements Jobs {
    private readonly queue: Queue;
    private readonly transcodes: Queue;

    constructor(redisUrl: string) {
        this.queue = new Queue(MEDIA_QUEUE, {
            connection: redisConnection(redisUrl),
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: 'exponential', delay: 5_000 },
                removeOnComplete: { count: 500 },
                removeOnFail: { count: 1000 },
            },
        });
        this.transcodes = new Queue(TRANSCODE_QUEUE, {
            connection: redisConnection(redisUrl),
            defaultJobOptions: {
                attempts: 2,
                backoff: { type: 'fixed', delay: 30_000 },
                removeOnComplete: { count: 500 },
                removeOnFail: { count: 1000 },
            },
        });
    }

    async enqueueTranscode(videoId: string) {
        await this.transcodes.add('transcode', { videoId });
    }

    async enqueueProbe(videoId: string) {
        // No jobId: completed jobs are kept, so a fixed id would block reprocessing.
        // Completion is claimed atomically, and a repeated probe is harmless.
        await this.queue.add('probe', { videoId });
    }

    async scheduleCleanup() {
        await this.queue.upsertJobScheduler('cleanup-hourly', { every: 3_600_000 }, { name: 'cleanup', data: {} });
    }

    async close() {
        await Promise.all([this.queue.close(), this.transcodes.close()]);
    }
}

/** Without Redis, jobs can't run; log so it's obvious why videos sit in Processing. */
export class NoJobs implements Jobs {
    constructor(private readonly logger?: Logger) {}
    async enqueueProbe(videoId: string) {
        this.logger?.warn({ videoId }, 'REDIS_URL not set: probe job not queued');
    }
    async enqueueTranscode(videoId: string) {
        this.logger?.warn({ videoId }, 'REDIS_URL not set: transcode job not queued');
    }
    async close() {}
}

/** Tests: records what would have been queued. */
export class MemoryJobs implements Jobs {
    readonly probes: string[] = [];
    readonly transcodes: string[] = [];
    async enqueueTranscode(videoId: string) {
        this.transcodes.push(videoId);
    }
    async enqueueProbe(videoId: string) {
        this.probes.push(videoId);
    }
    async close() {}
}
