import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import type { Config } from './config.js';
import type { Logger } from './lib/logger.js';
import { BullJobs, type Jobs, NoJobs } from './lib/queue.js';
import { S3Storage, type Storage } from './lib/storage.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { createAdminRouter } from './routes/admin.js';
import { createAuthRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { createVideosRouter } from './routes/videos.js';

export interface AppDeps {
    storage: Storage;
    jobs: Jobs;
}

/** Real storage and queue from config; tests pass in-memory fakes instead. */
export function defaultDeps(config: Config, logger: Logger): AppDeps {
    return {
        storage: new S3Storage(config),
        jobs: config.REDIS_URL ? new BullJobs(config.REDIS_URL) : new NoJobs(logger),
    };
}

export function createApp(config: Config, logger: Logger, deps: AppDeps = defaultDeps(config, logger)) {
    const app = express();

    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(helmet());
    app.use(express.json({ limit: '100kb' }));
    app.use(cookieParser());

    app.use('/api/health', healthRouter);
    app.use('/api/auth', createAuthRouter(config, logger));
    app.use('/api/admin', createAdminRouter(config, logger, deps.storage, deps.jobs));
    app.use('/api/videos', createVideosRouter(config, logger, deps.storage, deps.jobs));

    app.use('/api', apiNotFound);
    app.use(errorHandler(logger));

    return app;
}
