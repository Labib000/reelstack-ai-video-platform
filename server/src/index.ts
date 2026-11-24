import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { connectMongo, disconnectMongo } from './db.js';
import { createLogger } from './lib/logger.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';

const config = loadConfig();
const logger = createLogger(config);

if (config.REDIS_URL) connectRedis(config.REDIS_URL, logger);
await connectMongo(config.MONGO_URI, logger);

const server = createApp(config, logger).listen(config.PORT, () => {
    logger.info(`API listening on http://localhost:${config.PORT}`);
});

async function shutdown(signal: string) {
    logger.info(`${signal} received, shutting down`);
    server.close();
    await Promise.allSettled([disconnectMongo(), disconnectRedis()]);
    process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
