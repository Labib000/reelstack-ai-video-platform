import { randomUUID } from 'node:crypto';

import mongoose from 'mongoose';
import request, { type Response } from 'supertest';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

import { createApp } from '../../src/app.js';
import { type Config, loadConfig } from '../../src/config.js';
import { createLogger } from '../../src/lib/logger.js';

export function testConfig(overrides: Record<string, string> = {}): Config {
    return loadConfig({
        NODE_ENV: 'test',
        MONGO_URI: inject('mongoUri'),
        JWT_ACCESS_SECRET: 'test-secret-that-is-at-least-32-characters-long',
        ...overrides,
    });
}

/**
 * Connects mongoose to a database of its own for this test file, builds the
 * indexes (unique email, token hash), and empties every collection after each
 * test. Returns the app to send requests to.
 */
export function useTestApp(overrides: Record<string, string> = {}) {
    const config = testConfig(overrides);
    const app = createApp(config, createLogger(config));

    beforeAll(async () => {
        await mongoose.connect(config.MONGO_URI, {
            dbName: `test_${randomUUID().slice(0, 8)}`,
        });
        await mongoose.connection.syncIndexes();
    });

    afterEach(async () => {
        const collections = await mongoose.connection.db!.collections();
        await Promise.all(collections.map((c) => c.deleteMany({})));
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.disconnect();
    });

    return { app, config };
}

/** The `rs_refresh=...` pair from a response's Set-Cookie, for the next request. */
export function refreshCookie(res: Response): string {
    const header = res.headers['set-cookie'] as unknown as string[] | undefined;
    const cookie = header?.find((c) => c.startsWith('rs_refresh='));
    if (!cookie) throw new Error('No rs_refresh cookie in response');
    return cookie.split(';')[0]!;
}

export const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

let counter = 0;

/** A complete, valid register body with a unique email and username. */
export function validRegistration(overrides: Record<string, unknown> = {}) {
    counter += 1;
    return {
        name: 'Test User',
        username: `user${counter}`,
        email: `user${counter}@example.com`,
        password: 'correct-horse-battery-9',
        dateOfBirth: '1995-06-15',
        interests: ['Programming'],
        acceptTerms: true,
        ...overrides,
    };
}

/** Registers a fresh user; returns its access token and refresh cookie. */
export async function registerUser(
    app: Parameters<typeof request>[0],
    overrides: Partial<{ name: string; username: string; email: string; password: string }> = {},
) {
    const body = validRegistration(overrides);
    const res = await request(app).post('/api/auth/register').send(body);
    if (res.status !== 201) {
        throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
    }
    return {
        ...body,
        accessToken: res.body.accessToken as string,
        cookie: refreshCookie(res),
        userId: res.body.user.id as string,
    };
}
