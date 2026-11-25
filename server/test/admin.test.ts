import type { Role, VideoStatus } from '@reelstack/shared';
import { Types } from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { AuditLog } from '../src/models/AuditLog.js';
import { User } from '../src/models/User.js';
import { Video } from '../src/models/Video.js';
import { CSRF, registerUser, useTestApp } from './support/app.js';

const { app, storage, jobs } = useTestApp();

async function userWithRole(role: Role, overrides: Parameters<typeof registerUser>[1] = {}) {
    const user = await registerUser(app, overrides);
    await User.updateOne({ _id: user.userId }, { $set: { role } });
    return user;
}

const get = (token: string, path: string) => request(app).get(`/api/admin${path}`).set('Authorization', `Bearer ${token}`);
const post = (token: string, path: string, body: object = {}) =>
    request(app).post(`/api/admin${path}`).set('Authorization', `Bearer ${token}`).send(body);

describe('permissions', () => {
    it('moderators see stats but not users or the audit log; users see nothing', async () => {
        const mod = await userWithRole('moderator');
        const user = await registerUser(app);

        expect((await get(mod.accessToken, '/stats')).status).toBe(200);
        expect((await get(mod.accessToken, '/users')).status).toBe(403);
        expect((await get(mod.accessToken, '/audit')).status).toBe(403);
        expect((await post(mod.accessToken, `/users/${user.userId}/ban`, { reason: 'spam' })).status).toBe(403);

        expect((await get(user.accessToken, '/stats')).status).toBe(403);
        expect((await request(app).get('/api/admin/stats')).status).toBe(401);
    });
});

describe('GET /stats', () => {
    it('counts users, roles, sessions, interests and fills 30 days of signups', async () => {
        const admin = await userWithRole('admin');
        await registerUser(app, {});
        const old = await registerUser(app);
        await User.collection.updateOne({ _id: new Types.ObjectId(old.userId) }, { $set: { createdAt: new Date(Date.now() - 20 * 86_400_000) } });

        const res = await get(admin.accessToken, '/stats');
        expect(res.status).toBe(200);
        expect(res.body.users).toMatchObject({ total: 3, new7d: 2, new30d: 3, banned: 0, byRole: { user: 2, moderator: 0, admin: 1 } });
        expect(res.body.activeSessions).toBe(3);
        expect(res.body.signupsByDay).toHaveLength(30);
        expect(res.body.signupsByDay.reduce((n: number, d: { count: number }) => n + d.count, 0)).toBe(3);
        expect(res.body.topInterests[0]).toEqual({ interest: 'Programming', count: 3 });
        expect(res.body.recentSignups).toHaveLength(3);
    });
});

describe('GET /users', () => {
    it('searches by name, email or @handle, filters and paginates', async () => {
        const admin = await userWithRole('admin');
        await registerUser(app, { name: 'Grace Hopper', username: 'grace' });
        await registerUser(app, { name: 'Alan Turing', username: 'alan' });
        await userWithRole('moderator', { name: 'Mod Person' });

        const byHandle = await get(admin.accessToken, '/users?q=@grace');
        expect(byHandle.body.items.map((u: { name: string }) => u.name)).toEqual(['Grace Hopper']);
        expect(byHandle.body.items[0].activeSessions).toBe(1);

        const mods = await get(admin.accessToken, '/users?role=moderator');
        expect(mods.body.total).toBe(1);

        const page = await get(admin.accessToken, '/users?pageSize=2&page=2&sort=oldest');
        expect(page.body).toMatchObject({ total: 4, page: 2, pageSize: 2 });
        expect(page.body.items).toHaveLength(2);

        expect((await get(admin.accessToken, '/users?q=(')).status).toBe(200);
        expect((await get(admin.accessToken, '/users?pageSize=500')).status).toBe(422);
    });
});

describe('ban / unban', () => {
    it('suspends an account everywhere and audits it; unban restores login', async () => {
        const admin = await userWithRole('admin');
        const target = await registerUser(app);

        const ban = await post(admin.accessToken, `/users/${target.userId}/ban`, { reason: 'Spam links' });
        expect(ban.status).toBe(200);
        expect(ban.body.user).toMatchObject({ banReason: 'Spam links', activeSessions: 0 });

        // Existing access token, refresh cookie and fresh login all refused.
        expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${target.accessToken}`)).status).toBe(401);
        expect((await request(app).post('/api/auth/refresh').set(CSRF).set('Cookie', target.cookie)).status).toBe(401);
        const login = () => request(app).post('/api/auth/login').send({ email: target.email, password: target.password });
        const refused = await login();
        expect(refused.status).toBe(403);
        expect(refused.body.message).toMatch(/suspended/);

        const entry = await AuditLog.findOne({ action: 'user.banned' }).lean();
        expect(entry?.target?.toString()).toBe(target.userId);

        expect((await post(admin.accessToken, `/users/${target.userId}/unban`)).status).toBe(200);
        expect((await login()).status).toBe(200);
        expect(await AuditLog.countDocuments({ action: 'user.unbanned' })).toBe(1);
    });

    it('refuses to suspend yourself or another admin, and needs a reason', async () => {
        const admin = await userWithRole('admin');
        const other = await userWithRole('admin');
        const user = await registerUser(app);

        expect((await post(admin.accessToken, `/users/${admin.userId}/ban`, { reason: 'test' })).status).toBe(422);
        expect((await post(admin.accessToken, `/users/${other.userId}/ban`, { reason: 'test' })).status).toBe(422);
        expect((await post(admin.accessToken, `/users/${user.userId}/ban`, {})).body.errors).toHaveProperty('reason');
    });

    it('blocks a banned user whose access token predates the ban', async () => {
        const admin = await userWithRole('admin');
        const target = await registerUser(app);
        // Ban directly (no token bump) to prove requireAuth checks bannedAt itself.
        await User.updateOne({ _id: target.userId }, { $set: { bannedAt: new Date() } });
        const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${target.accessToken}`);
        expect(me.status).toBe(403);
        expect(admin).toBeDefined();
    });
});

describe('role changes and forced sign-out', () => {
    it('audits role changes with from/to', async () => {
        const admin = await userWithRole('admin');
        const target = await registerUser(app);
        await request(app)
            .patch(`/api/admin/users/${target.userId}/role`)
            .set('Authorization', `Bearer ${admin.accessToken}`)
            .send({ role: 'moderator' });

        const audit = await get(admin.accessToken, `/audit?target=${target.userId}`);
        expect(audit.body.items).toHaveLength(1);
        expect(audit.body.items[0]).toMatchObject({
            action: 'user.role_changed',
            meta: { from: 'user', to: 'moderator' },
            actor: { id: admin.userId },
            target: { id: target.userId },
        });
    });

    it('signs a user out of every device', async () => {
        const admin = await userWithRole('admin');
        const target = await registerUser(app);

        const res = await post(admin.accessToken, `/users/${target.userId}/revoke-sessions`);
        expect(res.status).toBe(200);
        expect(res.body.user.activeSessions).toBe(0);
        expect((await request(app).get('/api/auth/me').set('Authorization', `Bearer ${target.accessToken}`)).status).toBe(401);
        const audit = await get(admin.accessToken, '/audit?action=user.sessions_revoked');
        expect(audit.body.items[0].meta).toEqual({ sessions: '1' });
    });
});

describe('video moderation', () => {
    async function videoOf(ownerId: string, status: VideoStatus = 'processing', title = 'Clip') {
        return Video.create({
            owner: new Types.ObjectId(ownerId),
            title,
            status,
            sourceKey: 'uploads/x/source.mp4',
            partSize: 1,
            sizeBytes: 2048,
            contentType: 'video/mp4',
        });
    }

    it('lists videos with owners; filters by status, search and removed', async () => {
        const mod = await userWithRole('moderator');
        const owner = await registerUser(app, { name: 'Owner One' });
        await videoOf(owner.userId, 'processing', 'Rust talk');
        await videoOf(owner.userId, 'failed', 'Broken file');

        const all = await get(mod.accessToken, '/videos');
        expect(all.status).toBe(200);
        expect(all.body.total).toBe(2);
        expect(all.body.items[0].owner).toMatchObject({ id: owner.userId, name: 'Owner One' });
        expect((await get(mod.accessToken, '/videos?status=failed')).body.items.map((v: { title: string }) => v.title)).toEqual(['Broken file']);
        expect((await get(mod.accessToken, '/videos?q=rust')).body.total).toBe(1);
        expect((await get(owner.accessToken, '/videos')).status).toBe(403);
    });

    it('removes and restores with a reason, audited; users cannot', async () => {
        const mod = await userWithRole('moderator');
        const owner = await registerUser(app);
        const video = await videoOf(owner.userId);

        expect((await post(owner.accessToken, `/videos/${video.id}/remove`, { reason: 'spam' })).status).toBe(403);
        expect((await post(mod.accessToken, `/videos/${video.id}/remove`, { reason: 'x' })).status).toBe(422);
        const removed = await post(mod.accessToken, `/videos/${video.id}/remove`, { reason: 'Copyrighted footage' });
        expect(removed.status).toBe(200);
        expect(removed.body.video.removedReason).toBe('Copyrighted footage');
        expect((await post(mod.accessToken, `/videos/${video.id}/remove`, { reason: 'again' })).status).toBe(409);
        expect((await get(mod.accessToken, '/videos?status=removed')).body.total).toBe(1);

        expect((await post(mod.accessToken, `/videos/${video.id}/restore`)).body.video.removedAt).toBeNull();

        const entries = await AuditLog.find({ video: video._id }).sort({ createdAt: 1 }).lean();
        expect(entries.map((e) => e.action)).toEqual(['video.removed', 'video.restored']);
        expect(entries[0]!.target!.toString()).toBe(owner.userId);
    });

    it('reprocesses only failed videos and queues a new probe', async () => {
        const mod = await userWithRole('moderator');
        const owner = await registerUser(app);
        const ok = await videoOf(owner.userId, 'processing');
        const failed = await videoOf(owner.userId, 'failed');

        expect((await post(mod.accessToken, `/videos/${ok.id}/reprocess`)).status).toBe(409);
        expect((await post(mod.accessToken, `/videos/${failed.id}/reprocess`)).status).toBe(409); // file gone
        storage.objects.set(failed.sourceKey, 2048);
        await Video.updateOne({ _id: failed._id }, { $set: { processedAt: new Date() } });
        const res = await post(mod.accessToken, `/videos/${failed.id}/reprocess`);
        expect(res.status).toBe(200);
        expect(res.body.video.status).toBe('processing');
        expect(res.body.video.processedAt).toBeNull();
        expect(jobs.probes).toEqual([failed.id]);
    });

    it('stats count videos and storage', async () => {
        const admin = await userWithRole('admin');
        await videoOf(admin.userId, 'processing');
        await videoOf(admin.userId, 'failed');
        await videoOf(admin.userId, 'uploading');
        const { videos } = (await get(admin.accessToken, '/stats')).body;
        expect(videos).toEqual({ total: 3, uploading: 1, processing: 1, failed: 1, storageBytes: 4096 });
    });
});
