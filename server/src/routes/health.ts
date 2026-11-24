import type { HealthResponse } from '@reelstack/shared';
import { Router } from 'express';

import { mongoStatus } from '../db.js';
import { redisStatus } from '../lib/redis.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
    const mongo = mongoStatus();
    const redis = await redisStatus();
    const body: HealthResponse = {
        status: mongo === 'up' && redis !== 'down' ? 'ok' : 'degraded',
        mongo,
        redis,
        uptimeSec: Math.round(process.uptime()),
    };
    res.status(mongo === 'up' ? 200 : 503).json(body);
});
