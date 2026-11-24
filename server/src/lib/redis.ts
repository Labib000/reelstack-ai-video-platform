/**
 * The optional shared Redis connection (adapted from Hisaab-mern).
 *
 * Tuned to fail fast so callers can fall back the moment Redis is slow or
 * down: it connects in the background, commands fail at once while
 * disconnected, and it keeps reconnecting with backoff up to 5 s.
 */
import { Redis } from 'ioredis';

import type { Logger } from './logger.js';

export type RedisStatus = 'up' | 'down' | 'disabled';

const CONNECT_TIMEOUT_MS = 2_000;
const COMMAND_TIMEOUT_MS = 500;
const MAX_RECONNECT_DELAY_MS = 5_000;
const ERROR_LOG_INTERVAL_MS = 60_000;

let client: Redis | null = null;

export function connectRedis(url: string, logger?: Logger): Redis {
    if (client) client.disconnect();

    const redis = new Redis(url, {
        lazyConnect: true,
        connectTimeout: CONNECT_TIMEOUT_MS,
        commandTimeout: COMMAND_TIMEOUT_MS,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy: (attempt) =>
            Math.min(attempt * 200, MAX_RECONNECT_DELAY_MS),
    });

    let failing = false;
    let lastLoggedAt = 0;

    // Without an 'error' listener ioredis reports every failed reconnect as
    // unhandled. Log the first one, then at most once a minute.
    redis.on('error', (error: Error & { code?: string }) => {
        const now = Date.now();
        if (!failing || now - lastLoggedAt >= ERROR_LOG_INTERVAL_MS) {
            logger?.warn(
                { err: error.message || error.code || error.name },
                failing ? 'Redis still unavailable' : 'Redis unavailable',
            );
            lastLoggedAt = now;
        }
        failing = true;
    });

    redis.on('ready', () => {
        logger?.info(failing ? 'Redis reconnected' : 'Redis connected');
        failing = false;
    });

    redis.connect().catch(() => {});

    client = redis;
    return redis;
}

/** The shared client, or null when Redis isn't configured. */
export function getRedis(): Redis | null {
    return client;
}

export async function disconnectRedis(): Promise<void> {
    const redis = client;
    if (!redis) return;
    client = null;

    if (redis.status === 'ready') {
        try {
            await redis.quit();
            return;
        } catch {
            // Fall through to a hard disconnect.
        }
    }
    redis.disconnect();
}

/** "up" when Redis answers PING, "down" when it doesn't, "disabled" when unset. */
export async function redisStatus(): Promise<RedisStatus> {
    const redis = client;
    if (!redis) return 'disabled';

    try {
        return (await redis.ping()) === 'PONG' ? 'up' : 'down';
    } catch {
        return 'down';
    }
}
