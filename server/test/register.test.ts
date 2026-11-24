import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { hashPassword } from '../src/auth/password.js';
import { User } from '../src/models/User.js';
import { registerUser, useTestApp, validRegistration } from './support/app.js';

const { app } = useTestApp();

const register = (overrides: Record<string, unknown>) =>
    request(app).post('/api/auth/register').send(validRegistration(overrides));

/** YYYY-MM-DD for `years` years ago, give or take `days`. */
function yearsAgo(years: number, days = 0): string {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - years);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

describe('register: profile fields', () => {
    it('stores username, date of birth, interests and when terms were accepted', async () => {
        const res = await register({ username: 'grace_h', interests: ['Science', 'Music'], marketingOptIn: true });
        expect(res.status).toBe(201);

        const user = await User.findOne({ username: 'grace_h' }).lean();
        expect(user?.dateOfBirth?.toISOString().slice(0, 10)).toBe('1995-06-15');
        expect(user?.interests).toEqual(['Science', 'Music']);
        expect(user?.termsAcceptedAt).toBeInstanceOf(Date);
        expect(user?.marketingOptIn).toBe(true);
    });

    it('rejects anyone under 13, and accepts a 13th birthday today', async () => {
        const young = await register({ dateOfBirth: yearsAgo(13, 1) });
        expect(young.status).toBe(422);
        expect(young.body.errors).toHaveProperty('dateOfBirth');

        expect((await register({ dateOfBirth: yearsAgo(13) })).status).toBe(201);
    });

    it('rejects impossible and future dates', async () => {
        expect((await register({ dateOfBirth: '1999-02-30' })).body.errors).toHaveProperty('dateOfBirth');
        expect((await register({ dateOfBirth: yearsAgo(-1) })).body.errors).toHaveProperty('dateOfBirth');
    });

    it('requires accepting the terms', async () => {
        const res = await register({ acceptTerms: false });
        expect(res.status).toBe(422);
        expect(res.body.errors).toHaveProperty('acceptTerms');
    });

    it('requires one to five known interests', async () => {
        expect((await register({ interests: [] })).body.errors).toHaveProperty('interests');
        expect((await register({ interests: ['Cats'] })).status).toBe(422);
        const six = ['Programming', 'Science', 'Design', 'Food', 'Business', 'Music'];
        expect((await register({ interests: six })).body.errors).toHaveProperty('interests');
    });

    it('requires a password with a letter and a number', async () => {
        const res = await register({ password: 'no-digits-here' });
        expect(res.status).toBe(422);
        expect(res.body.errors.password).toMatch(/number/);
    });

    it('rejects malformed and reserved usernames', async () => {
        expect((await register({ username: '9lives' })).body.errors).toHaveProperty('username');
        expect((await register({ username: 'has space' })).body.errors).toHaveProperty('username');
        expect((await register({ username: 'admin' })).body.errors).toHaveProperty('username');
    });

    it('rejects a username that is taken, ignoring case', async () => {
        await registerUser(app, { username: 'taken' });
        const res = await register({ username: 'TAKEN' });
        expect(res.status).toBe(422);
        expect(res.body.errors.username).toBe('That username is taken.');
    });
});

describe('GET /api/auth/username-available', () => {
    const check = (username: string) => request(app).get('/api/auth/username-available').query({ username });

    it('reports free, taken and invalid handles', async () => {
        await registerUser(app, { username: 'linus' });

        expect((await check('fresh_name')).body).toEqual({ available: true });
        expect((await check('Linus')).body).toEqual({ available: false, reason: 'That username is taken.' });

        const invalid = await check('x');
        expect(invalid.body.available).toBe(false);
        expect(invalid.body.reason).toMatch(/at least 3/);
    });
});

describe('older accounts', () => {
    it('can still log in with a password that predates the number rule, and have no username', async () => {
        await User.create({ name: 'Old', email: 'old@example.com', passwordHash: await hashPassword('lettersonly') });
        const res = await request(app).post('/api/auth/login').send({ email: 'old@example.com', password: 'lettersonly' });
        expect(res.status).toBe(200);
        expect(res.body.user.username).toBeNull();
    });
});
