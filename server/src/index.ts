import { createApp, defaultDeps } from './app.js';
import { loadConfig } from './config.js';
import { connectMongo, disconnectMongo } from './db.js';
import { createLogger } from './lib/logger.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';

const config = loadConfig();
const logger = createLogger(config);

if (config.REDIS_URL) connectRedis(config.REDIS_URL, logger);
await connectMongo(config.MONGO_URI, logger);

const deps = defaultDeps(config, logger);
const server = createApp(config, logger, deps).listen(config.PORT, () => {
    logger.info(`API listening on http://localhost:${config.PORT}`);
});

async function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await Promise.allSettled([disconnectMongo(), disconnectRedis(), deps.jobs.close()]);
    process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
