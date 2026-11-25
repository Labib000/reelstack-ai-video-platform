/**
 * Fills a dev database with a demo admin, a moderator and ~40 realistic users
 * (spread-out signup dates, interests, a few suspended) plus audit history,
 * so the admin console has something to show. Safe to re-run: it first
 * removes everything on the demo domain.
 *   npm run seed:demo
 */
import { INTERESTS, type Role } from '@reelstack/shared';
import { Types } from 'mongoose';

import { hashPassword } from '../auth/password.js';
import { loadConfig } from '../config.js';
import { connectMongo, disconnectMongo } from '../db.js';
import { AuditLog } from '../models/AuditLog.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User } from '../models/User.js';

const DOMAIN = 'demo.reelstack.test';
const PASSWORD = 'ReelStack-demo-2026';
const DAY_MS = 86_400_000;

const config = loadConfig();
if (config.NODE_ENV === 'production') {
    console.error('seed:demo refuses to run with NODE_ENV=production.');
    process.exit(1);
}

const FIRST = ['Amara', 'Ben', 'Chen', 'Dana', 'Elif', 'Farid', 'Grace', 'Hiro', 'Isla', 'Jonas', 'Kavya', 'Liam', 'Maya', 'Noah', 'Olu', 'Priya', 'Quinn', 'Rosa', 'Sami', 'Tara', 'Umar', 'Vera', 'Wen', 'Ximena', 'Yusuf', 'Zoe', 'Aiden', 'Bea', 'Carlos', 'Dalia', 'Emre', 'Fatima', 'Gabe', 'Hana', 'Ivan', 'Jade', 'Kofi', 'Lena', 'Mateo', 'Nadia'];
const LAST = ['Okafor', 'Silva', 'Wang', 'Kowalski', 'Yilmaz', 'Rahman', 'Lindqvist', 'Tanaka', 'Murphy', 'Becker', 'Iyer', 'Dubois', 'Haddad', 'Novak', 'Adeyemi', 'Sharma', 'Rossi', 'Moreno', 'Khan', 'Fischer'];
const BAN_REASONS = ['Posting spam links in comments', 'Repeated harassment reports', 'Impersonating another creator'];

/** Small seeded PRNG so every run looks the same. */
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
const sample = <T>(list: readonly T[], n: number) => [...list].sort(() => rand() - 0.5).slice(0, n);

await connectMongo(config.MONGO_URI);

// 1. Clear the previous demo data.
const old = await User.find({ email: new RegExp(`@${DOMAIN.replace(/\./g, '\\.')}$`) }).select('_id').lean();
const oldIds = old.map((u) => u._id);
await Promise.all([
    RefreshToken.deleteMany({ userId: { $in: oldIds } }),
    AuditLog.deleteMany({ $or: [{ actor: { $in: oldIds } }, { target: { $in: oldIds } }] }),
]);
await User.deleteMany({ _id: { $in: oldIds } });

// 2. Users. One hash shared by all (argon2 is slow on purpose).
const passwordHash = await hashPassword(PASSWORD);
const now = Date.now();
type Doc = Record<string, unknown> & { _id: Types.ObjectId; role: Role; name: string };

function person(name: string, username: string, role: Role, daysAgo: number): Doc {
    const createdAt = new Date(now - daysAgo * DAY_MS - Math.floor(rand() * DAY_MS));
    const lastLoginDays = Math.min(daysAgo, Math.floor(rand() * 10));
    return {
        _id: new Types.ObjectId(),
        name,
        username,
        email: `${username.replace(/[._]/g, '')}@${DOMAIN}`,
        passwordHash,
        role,
        avatarUrl: null,
        tokenVersion: 0,
        dateOfBirth: new Date(Date.UTC(1975 + Math.floor(rand() * 30), Math.floor(rand() * 12), 1 + Math.floor(rand() * 27))),
        interests: sample(INTERESTS, 1 + Math.floor(rand() * 4)),
        termsAcceptedAt: createdAt,
        marketingOptIn: rand() > 0.6,
        bannedAt: null,
        banReason: null,
        bannedBy: null,
        lastLoginAt: new Date(now - lastLoginDays * DAY_MS - Math.floor(rand() * DAY_MS)),
        createdAt,
        updatedAt: createdAt,
    };
}

const admin = person('Demo Admin', 'demo.admin', 'admin', 75);
admin.email = `admin@${DOMAIN}`;
const moderator = person('Demo Moderator', 'demo.mod', 'moderator', 60);
moderator.email = `mod@${DOMAIN}`;

const used = new Set<string>();
const people: Doc[] = FIRST.map((first) => {
    const last = pick(LAST);
    let handle = `${first}.${last}`.toLowerCase();
    while (used.has(handle)) handle += Math.floor(rand() * 9);
    used.add(handle);
    // Skew toward recent signups so the chart has a shape.
    const daysAgo = Math.floor(Math.pow(rand(), 1.6) * 58);
    return person(`${first} ${last}`, handle, 'user', daysAgo);
});
people[3]!.role = 'moderator';

/** Accounts that appear in the audit history must exist before it: make them older. */
function backdate(u: Doc, daysAgo: number) {
    const createdAt = new Date(now - daysAgo * DAY_MS);
    Object.assign(u, { createdAt, updatedAt: createdAt, termsAcceptedAt: createdAt });
}
const banned = sample(people.slice(13), 3);
for (const u of [people[3]!, people[8]!, people[12]!, ...banned]) backdate(u, 40 + Math.floor(rand() * 15));

await User.collection.insertMany([admin, moderator, ...people]);

// 3. Some history in the audit log, oldest first.
const entries: Record<string, unknown>[] = [];
const at = (daysAgo: number) => new Date(now - daysAgo * DAY_MS - Math.floor(rand() * DAY_MS / 2));
entries.push({ actor: admin._id, action: 'user.role_changed', target: moderator._id, meta: { from: 'user', to: 'moderator' }, createdAt: at(55) });
entries.push({ actor: admin._id, action: 'user.role_changed', target: people[3]!._id, meta: { from: 'user', to: 'moderator' }, createdAt: at(20) });

banned.forEach((u, i) => {
    const when = at(12 - i * 4);
    Object.assign(u, { bannedAt: when, banReason: BAN_REASONS[i], bannedBy: admin._id, lastLoginAt: new Date(when.getTime() - 2 * DAY_MS) });
    entries.push({ actor: i === 2 ? moderator._id : admin._id, action: 'user.sessions_revoked', target: u._id, meta: { sessions: String(1 + i) }, createdAt: new Date(when.getTime() - 3_600_000) });
    entries.push({ actor: admin._id, action: 'user.banned', target: u._id, meta: { reason: BAN_REASONS[i]! }, createdAt: when });
});
const forgiven = people[8]!;
entries.push({ actor: admin._id, action: 'user.banned', target: forgiven._id, meta: { reason: 'Suspected bot account' }, createdAt: at(30) });
entries.push({ actor: admin._id, action: 'user.unbanned', target: forgiven._id, meta: {}, createdAt: at(28) });
entries.push({ actor: admin._id, action: 'user.sessions_revoked', target: people[12]!._id, meta: { sessions: '2' }, createdAt: at(2) });

for (const u of banned) {
    await User.updateOne({ _id: u._id }, { $set: { bannedAt: u.bannedAt, banReason: u.banReason, bannedBy: u.bannedBy, lastLoginAt: u.lastLoginAt } });
}
await AuditLog.collection.insertMany(entries);

await disconnectMongo();

console.log(`Seeded ${2 + people.length} demo users and ${entries.length} audit entries.

  Admin      admin@${DOMAIN}
  Moderator  mod@${DOMAIN}
  Password   ${PASSWORD}   (same for every demo account)
`);
