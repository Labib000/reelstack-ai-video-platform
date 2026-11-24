import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

import type { Logger } from './lib/logger.js';
import { healthRouter } from './routes/health.js';

export function createApp(logger: Logger) {
    const app = express();

    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(helmet());
    app.use(express.json({ limit: '100kb' }));
    app.use(cookieParser());

    app.use('/api/health', healthRouter);

    app.use('/api', (_req, res) => {
        res.status(404).json({ error: 'Not found' });
    });

    app.use(
        (
            err: unknown,
            _req: express.Request,
            res: express.Response,
            _next: express.NextFunction,
        ) => {
            logger.error({ err }, 'Unhandled error');
            res.status(500).json({ error: 'Internal server error' });
        },
    );

    return app;
}
