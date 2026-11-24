import { type Role, can } from '@reelstack/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { User } from '../src/models/User.js';
import { registerUser, useTestApp, validRegistration } from './support/app.js';

const { app } = useTestApp();

async function userWithRole(role: Role) {
    const user = await registerUser(app);
    await User.updateOne({ _id: user.userId }, { $set: { role } });
    return user;
}

const setRole = (token: string, id: string, role: unknown) =>
    request(app)
        .patch(`/api/admin/users/${id}/role`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role });

describe('permissions', () => {
    it.each([
        ['user', 'video:moderate', false],
        ['moderator', 'video:moderate', true],
        ['moderator', 'comment:moderate', true],
        ['moderator', 'user:ban', false],
        ['moderator', 'user:set-role', false],
        ['admin', 'user:ban', true],
        ['admin', 'user:set-role', true],
    ] as const)('%s can %s: %s', (role, permission, allowed) => {
        expect(can(role, permission)).toBe(allowed);
    });

    it('guests can do nothing', () => {
        expect(can(null, 'video:moderate')).toBe(false);
    });
});

describe('PATCH /api/admin/users/:id/role', () => {
    it('lets an admin promote a user to moderator', async () => {
        const admin = await userWithRole('admin');
        const target = await registerUser(app);

        const res = await setRole(admin.accessToken, target.userId, 'moderator');

        expect(res.status).toBe(200);
        expect(res.body.user.role).toBe('moderator');
        // The role is read from the DB on each request, so the target's
        // existing token reflects it immediately.
        const me = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${target.accessToken}`);
        expect(me.body.user.role).toBe('moderator');
    });

    it.each(['user', 'moderator'] as const)('forbids a %s', async (role) => {
        const actor = await userWithRole(role);
        const target = await registerUser(app);

        expect((await setRole(actor.accessToken, target.userId, 'admin')).status).toBe(403);
        expect((await User.findById(target.userId).lean())!.role).toBe('user');
    });

    it('requires authentication', async () => {
        const target = await registerUser(app);
        const res = await request(app)
            .patch(`/api/admin/users/${target.userId}/role`)
            .send({ role: 'admin' });
        expect(res.status).toBe(401);
    });

    it("stops an admin changing their own role", async () => {
        const admin = await userWithRole('admin');
        expect((await setRole(admin.accessToken, admin.userId, 'user')).status).toBe(422);
    });

    it('validates the role and the user id', async () => {
        const admin = await userWithRole('admin');
        const target = await registerUser(app);

        expect((await setRole(admin.accessToken, target.userId, 'superuser')).status).toBe(422);
        expect((await setRole(admin.accessToken, 'not-an-id', 'moderator')).status).toBe(404);
        expect((await setRole(admin.accessToken, '0123456789abcdef01234567', 'moderator')).status).toBe(404);
    });

    it('new accounts are always plain users', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(validRegistration({ name: 'Sneaky', role: 'admin' }));
        expect(res.status).toBe(201);
        expect(res.body.user.role).toBe('user');
    });
});
