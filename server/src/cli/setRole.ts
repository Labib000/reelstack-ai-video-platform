/**
 * Sets a user's role from the command line. This is how the first admin is
 * made, since nobody can sign up as one:
 *   npm run user:role -- someone@example.com admin
 */
import { ROLES, type Role } from '@reelstack/shared';

import { loadConfig } from '../config.js';
import { connectMongo, disconnectMongo } from '../db.js';
import { User } from '../models/User.js';

const [email, role] = process.argv.slice(2);

if (!email || !role || !(ROLES as readonly string[]).includes(role)) {
    console.error(`Usage: npm run user:role -- <email> <${ROLES.join('|')}>`);
    process.exit(1);
}

const config = loadConfig();
await connectMongo(config.MONGO_URI);

const user = await User.findOneAndUpdate(
    { email: email.trim().toLowerCase() },
    { $set: { role: role as Role } },
    { returnDocument: 'after' },
).lean();

await disconnectMongo();

if (!user) {
    console.error(`No user with email ${email}`);
    process.exit(1);
}
console.log(`${user.email} is now ${user.role}`);
