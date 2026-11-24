import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import type { Config } from './config.js';
import type { Logger } from './lib/logger.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import { createAdminRouter } from './routes/admin.js';
import { createAuthRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';

export function createApp(config: Config, logger: Logger) {
    const app = express();

    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(helmet());
    app.use(express.json({ limit: '100kb' }));
    app.use(cookieParser());

    app.use('/api/health', healthRouter);
    app.use('/api/auth', createAuthRouter(config, logger));
    app.use('/api/admin', createAdminRouter(config));

    app.use('/api', apiNotFound);
    app.use(errorHandler(logger));

    return app;
}
