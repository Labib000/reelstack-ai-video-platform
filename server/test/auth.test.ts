import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RefreshToken } from '../src/models/RefreshToken.js';
import { CSRF, refreshCookie, registerUser, useTestApp } from './support/app.js';

const { app } = useTestApp();

const refresh = (cookie: string) =>
    request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', cookie);

const me = (accessToken: string) =>
    request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);

afterEach(() => {
    vi.useRealTimers();
});

describe('register', () => {
    it('returns an access token and sets an httpOnly refresh cookie on /api/auth', async () => {
        const res = await request(app).post('/api/auth/register').send({
            name: 'Ada',
            email: 'Ada@Example.com',
            password: 'correct-horse-battery',
        });

        expect(res.status).toBe(201);
        expect(res.body.accessToken).toEqual(expect.any(String));
        expect(res.body.user).toMatchObject({ name: 'Ada', email: 'ada@example.com', role: 'user' });
        expect(res.body.user).not.toHaveProperty('passwordHash');

        const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
        expect(cookie).toMatch(/^rs_refresh=/);
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Strict/i);
        expect(cookie).toMatch(/Path=\/api\/auth/);
    });

    it('stores only a hash of the refresh token', async () => {
        const { cookie } = await registerUser(app);
        const raw = cookie.split('=')[1]!;
        const docs = await RefreshToken.find().lean();

        expect(docs).toHaveLength(1);
        expect(docs[0]!.tokenHash).not.toBe(raw);
        expect(docs[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects a duplicate email with 422', async () => {
        await registerUser(app, { email: 'dup@example.com' });
        const res = await request(app).post('/api/auth/register').send({
            name: 'Again',
            email: 'DUP@example.com',
            password: 'another-password',
        });

        expect(res.status).toBe(422);
        expect(res.body.errors).toHaveProperty('email');
    });

    it('validates the body', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ name: '', email: 'not-an-email', password: 'short' });

        expect(res.status).toBe(422);
        expect(Object.keys(res.body.errors).sort()).toEqual(['email', 'name', 'password']);
    });
});

describe('login', () => {
    it('logs in with the right password', async () => {
        const user = await registerUser(app);
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: user.password });

        expect(res.status).toBe(200);
        expect(res.body.user.id).toBe(user.userId);
        expect(refreshCookie(res)).toMatch(/^rs_refresh=/);
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
        const user = await registerUser(app);
        const wrong = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: 'wrong-password' });
        const unknown = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@example.com', password: 'whatever-password' });

        expect(wrong.status).toBe(401);
        expect(unknown.status).toBe(401);
        expect(wrong.body).toEqual(unknown.body);
    });

    it('rate limits after 5 failed attempts', async () => {
        const user = await registerUser(app);
        for (let i = 0; i < 5; i++) {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ email: user.email, password: 'wrong-password' });
            expect(res.status).toBe(401);
        }
        const blocked = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: user.password });

        expect(blocked.status).toBe(429);
    });
});

describe('access token', () => {
    it('/me works with a valid token', async () => {
        const user = await registerUser(app);
        const res = await me(user.accessToken);

        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(user.email);
    });

    it('/me rejects a missing or tampered token', async () => {
        const user = await registerUser(app);

        expect((await request(app).get('/api/auth/me')).status).toBe(401);
        expect((await me(`${user.accessToken}x`)).status).toBe(401);
    });

    it('rejects an expired access token', async () => {
        const user = await registerUser(app);
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Date.now() + 16 * 60_000);

        expect((await me(user.accessToken)).status).toBe(401);
    });
});

describe('refresh rotation', () => {
    it('issues a new access token and a new refresh cookie', async () => {
        const user = await registerUser(app);
        const res = await refresh(user.cookie);

        expect(res.status).toBe(200);
        expect(res.body.accessToken).toEqual(expect.any(String));
        expect(refreshCookie(res)).not.toBe(user.cookie);
        expect((await me(res.body.accessToken)).status).toBe(200);
    });

    it('requires the X-Requested-With header', async () => {
        const user = await registerUser(app);
        const res = await request(app).post('/api/auth/refresh').set('Cookie', user.cookie);

        expect(res.status).toBe(403);
    });

    it('returns 401 without a cookie', async () => {
        expect((await request(app).post('/api/auth/refresh').set(CSRF)).status).toBe(401);
    });

    it('detects reuse of a rotated token and revokes the whole family', async () => {
        const user = await registerUser(app);
        const first = await refresh(user.cookie);
        const newCookie = refreshCookie(first);

        // An attacker replays the original (already rotated) token.
        const replay = await refresh(user.cookie);
        expect(replay.status).toBe(401);

        // The legitimate client's newest token is now dead too.
        expect((await refresh(newCookie)).status).toBe(401);

        const live = await RefreshToken.countDocuments({ revokedAt: null });
        expect(live).toBe(0);
        expect(await RefreshToken.countDocuments({ revokeReason: 'reuse' })).toBeGreaterThan(0);
    });

    it('lets only one of two concurrent refreshes win, then burns the family', async () => {
        const user = await registerUser(app);
        const results = await Promise.all([refresh(user.cookie), refresh(user.cookie)]);
        const statuses = results.map((r) => r.status).sort();

        expect(statuses).toEqual([200, 401]);
        const winner = results.find((r) => r.status === 200)!;
        expect((await refresh(refreshCookie(winner))).status).toBe(401);
    });

    it('rejects an expired refresh token', async () => {
        const user = await registerUser(app);
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(Date.now() + 8 * 86_400_000);

        expect((await refresh(user.cookie)).status).toBe(401);
    });
});

describe('logout', () => {
    it('revokes this device only', async () => {
        const user = await registerUser(app);
        const other = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: user.password });

        const res = await request(app)
            .post('/api/auth/logout')
            .set(CSRF)
            .set('Cookie', user.cookie);

        expect(res.status).toBe(204);
        expect((await refresh(user.cookie)).status).toBe(401);
        expect((await refresh(refreshCookie(other))).status).toBe(200);
    });

    it('logout-all kills every refresh token and existing access tokens', async () => {
        const user = await registerUser(app);
        const other = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: user.password });

        const res = await request(app)
            .post('/api/auth/logout-all')
            .set('Authorization', `Bearer ${user.accessToken}`);

        expect(res.status).toBe(204);
        expect((await me(user.accessToken)).status).toBe(401);
        expect((await me(other.body.accessToken)).status).toBe(401);
        expect((await refresh(refreshCookie(other))).status).toBe(401);
    });
});

describe('sessions', () => {
    it('lists active devices and marks the current one', async () => {
        const user = await registerUser(app);
        await request(app)
            .post('/api/auth/login')
            .set('User-Agent', 'OtherBrowser/1.0')
            .send({ email: user.email, password: user.password });

        const res = await request(app)
            .get('/api/auth/sessions')
            .set('Authorization', `Bearer ${user.accessToken}`)
            .set('Cookie', user.cookie);

        expect(res.status).toBe(200);
        expect(res.body.sessions).toHaveLength(2);
        expect(res.body.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    });

    it('signs out another device', async () => {
        const user = await registerUser(app);
        const other = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: user.password });
        const otherCookie = refreshCookie(other);
        const target = await RefreshToken.findOne({
            tokenHash: { $exists: true },
            createdAt: { $gte: new Date(Date.now() - 60_000) },
        })
            .sort({ createdAt: -1 })
            .lean();

        const res = await request(app)
            .delete(`/api/auth/sessions/${target!.familyId}`)
            .set('Authorization', `Bearer ${user.accessToken}`);

        expect(res.status).toBe(204);
        expect((await refresh(otherCookie)).status).toBe(401);
        expect((await refresh(user.cookie)).status).toBe(200);
    });

    it("returns 404 for someone else's session", async () => {
        const alice = await registerUser(app);
        await registerUser(app);
        const bobToken = await RefreshToken.findOne({
            userId: { $ne: alice.userId },
        }).lean();

        const res = await request(app)
            .delete(`/api/auth/sessions/${bobToken!.familyId}`)
            .set('Authorization', `Bearer ${alice.accessToken}`);

        expect(res.status).toBe(404);
    });
});
