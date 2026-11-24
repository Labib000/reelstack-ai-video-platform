import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { createLogger } from '../src/lib/logger.js';
import { testConfig } from './support/app.js';

// No mongoose.connect here on purpose: health must report Mongo as down.
const config = testConfig();
const app = createApp(config, createLogger(config));

describe('GET /api/health', () => {
    it('reports mongo down and redis disabled when nothing is connected', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(503);
        expect(res.body).toMatchObject({
            status: 'degraded',
            mongo: 'down',
            redis: 'disabled',
        });
    });

    it('returns JSON 404 for unknown API routes', async () => {
        const res = await request(app).get('/api/nope');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ message: 'Not found.' });
    });
});
