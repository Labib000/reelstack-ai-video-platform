import {
    type AdminStats,
    INTERESTS,
    type Interest,
    type Page,
    ROLES,
    type AdminVideoDTO,
    adminUserListQuerySchema,
    adminVideoListQuerySchema,
    auditListQuerySchema,
    banSchema,
    removeVideoSchema,
    roleSchema,
} from '@reelstack/shared';
import { type Request, type Response, Router } from 'express';
import { Types, isValidObjectId } from 'mongoose';
import { z } from 'zod';

import { RefreshService } from '../auth/refreshService.js';
import type { Config } from '../config.js';
import type { Logger } from '../lib/logger.js';
import type { Jobs } from '../lib/queue.js';
import type { Storage } from '../lib/storage.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { fieldErrors, parseOr422, sendValidationErrors } from '../middleware/validate.js';
import { AuditLog, audit, toAuditEntryDTO } from '../models/AuditLog.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { User, type UserFields, toAdminUserDTO, toUserDTO } from '../models/User.js';
import { Video, toAdminVideoDTO } from '../models/Video.js';

const setRoleSchema = z.object({ role: roleSchema });
const DAY_MS = 86_400_000;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Live refresh-token families per user (= signed-in devices). */
async function activeSessionCounts(userIds: Types.ObjectId[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows = await RefreshToken.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { userId: { $in: userIds }, revokedAt: null, expiresAt: { $gt: new Date() } } },
        { $group: { _id: { u: '$userId', f: '$familyId' } } },
        { $group: { _id: '$_id.u', n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id.toString(), r.n]));
}

async function adminDTOs(users: UserFields[]) {
    const counts = await activeSessionCounts(users.map((u) => u._id));
    return users.map((u) => toAdminUserDTO(u, counts.get(u._id.toString()) ?? 0));
}

/** Parses a query string with zod; 422 on failure. */
function parseQuery<T extends z.ZodType>(schema: T, req: Request, res: Response): z.infer<T> | undefined {
    const result = schema.safeParse(req.query);
    if (!result.success) {
        sendValidationErrors(res, fieldErrors(result.error));
        return undefined;
    }
    return result.data;
}

export function createAdminRouter(config: Config, logger: Logger, storage: Storage, jobs: Jobs): Router {
    const router = Router();
    const sessions = new RefreshService(config, logger);
    router.use(requireAuth(config));

    /** Loads the :id user or sends 404. */
    async function targetUser(req: Request, res: Response) {
        const { id } = req.params as { id: string };
        const user = isValidObjectId(id) ? await User.findById(id).lean() : null;
        if (!user) res.status(404).json({ message: 'User not found.' });
        return user;
    }

    router.get('/stats', requirePermission('moderation:view'), async (_req, res) => {
        const now = Date.now();
        const since = (days: number) => new Date(now - days * DAY_MS);
        const start30 = new Date(new Date(now - 29 * DAY_MS).toISOString().slice(0, 10));

        const [videoCounts, storage] = await Promise.all([
            Video.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
            Video.aggregate<{ bytes: number }>([{ $match: { status: { $ne: 'uploading' } } }, { $group: { _id: null, bytes: { $sum: '$sizeBytes' } } }]),
        ]);
        const vc = (s: string) => videoCounts.find((v) => v._id === s)?.n ?? 0;

        const [total, new7d, new30d, prev7d, banned, roles, perDay, interests, recent, families] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: since(7) } }),
            User.countDocuments({ createdAt: { $gte: since(30) } }),
            User.countDocuments({ createdAt: { $gte: since(14), $lt: since(7) } }),
            User.countDocuments({ bannedAt: { $ne: null } }),
            User.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
            User.aggregate<{ _id: string; n: number }>([
                { $match: { createdAt: { $gte: start30 } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
            ]),
            User.aggregate<{ _id: string; n: number }>([
                { $unwind: '$interests' },
                { $group: { _id: '$interests', n: { $sum: 1 } } },
                { $sort: { n: -1 } },
            ]),
            User.find().sort({ createdAt: -1 }).limit(5).lean(),
            RefreshToken.distinct('familyId', { revokedAt: null, expiresAt: { $gt: new Date() } }),
        ]);

        const byDay = new Map(perDay.map((d) => [d._id, d.n]));
        const signupsByDay = Array.from({ length: 30 }, (_, i) => {
            const date = new Date(start30.getTime() + i * DAY_MS).toISOString().slice(0, 10);
            return { date, count: byDay.get(date) ?? 0 };
        });
        const byRole = Object.fromEntries(ROLES.map((r) => [r, roles.find((x) => x._id === r)?.n ?? 0])) as AdminStats['users']['byRole'];

        const body: AdminStats = {
            users: { total, new7d, new30d, prev7d, banned, byRole },
            activeSessions: families.length,
            signupsByDay,
            topInterests: interests
                .filter((i): i is { _id: Interest; n: number } => (INTERESTS as readonly string[]).includes(i._id))
                .map((i) => ({ interest: i._id, count: i.n })),
            recentSignups: await adminDTOs(recent),
            videos: {
                total: videoCounts.reduce((n, v) => n + v.n, 0),
                uploading: vc('uploading'),
                processing: vc('processing'),
                failed: vc('failed'),
                storageBytes: storage[0]?.bytes ?? 0,
            },
        };
        res.json(body);
    });

    router.get('/users', requirePermission('user:view'), async (req, res) => {
        const query = parseQuery(adminUserListQuerySchema, req, res);
        if (!query) return;

        const filter: Record<string, unknown> = {};
        if (query.q) {
            const rx = new RegExp(escapeRegex(query.q.replace(/^@/, '')), 'i');
            filter.$or = [{ name: rx }, { email: rx }, { username: rx }];
        }
        if (query.role) filter.role = query.role;
        if (query.status === 'banned') filter.bannedAt = { $ne: null };
        if (query.status === 'active') filter.bannedAt = null;

        const sort: Record<string, 1 | -1> = {
            newest: { createdAt: -1 },
            oldest: { createdAt: 1 },
            name: { name: 1 },
            'last-login': { lastLoginAt: -1 },
        }[query.sort] as Record<string, 1 | -1>;

        const [users, total] = await Promise.all([
            User.find(filter)
                .sort({ ...sort, _id: -1 })
                .skip((query.page - 1) * query.pageSize)
                .limit(query.pageSize)
                .lean(),
            User.countDocuments(filter),
        ]);
        const body: Page<ReturnType<typeof toAdminUserDTO>> = {
            items: await adminDTOs(users),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
        res.json(body);
    });

    router.get('/users/:id', requirePermission('user:view'), async (req, res) => {
        const user = await targetUser(req, res);
        if (!user) return;
        res.json({ user: (await adminDTOs([user]))[0] });
    });

    /** Promote or demote a user. Admins can't change their own role. */
    router.patch('/users/:id/role', requirePermission('user:set-role'), async (req, res) => {
        const { id } = req.params as { id: string };
        const input = parseOr422(setRoleSchema, req.body, res);
        if (!input) return;

        if (id === req.user!.id) {
            sendValidationErrors(res, { role: 'You cannot change your own role.' });
            return;
        }

        const before = isValidObjectId(id) ? await User.findById(id).select('role').lean() : null;
        if (!before) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }
        // The role is read from the DB on every request, so this applies at once.
        const user = await User.findByIdAndUpdate(id, { $set: { role: input.role } }, { returnDocument: 'after' }).lean();
        if (before.role !== input.role) {
            await audit(req.user!.id, 'user.role_changed', id, { from: before.role, to: input.role });
        }
        res.json({ user: toUserDTO(user!) });
    });

    router.post('/users/:id/ban', requirePermission('user:ban'), async (req, res) => {
        const input = parseOr422(banSchema, req.body, res);
        if (!input) return;
        const user = await targetUser(req, res);
        if (!user) return;

        if (user._id.toString() === req.user!.id) {
            res.status(422).json({ message: 'You cannot suspend yourself.' });
            return;
        }
        if (user.role === 'admin') {
            res.status(422).json({ message: 'Admins can’t be suspended. Change their role first.' });
            return;
        }
        if (user.bannedAt) {
            res.status(409).json({ message: 'This account is already suspended.' });
            return;
        }

        await User.updateOne(
            { _id: user._id },
            { $set: { bannedAt: new Date(), banReason: input.reason, bannedBy: new Types.ObjectId(req.user!.id) } },
        );
        // Kick every device off right away (refresh tokens + access tokens).
        await sessions.revokeAllForUser(user._id.toString(), 'banned');
        await audit(req.user!.id, 'user.banned', user._id.toString(), { reason: input.reason });

        const updated = await User.findById(user._id).lean();
        res.json({ user: (await adminDTOs([updated!]))[0] });
    });

    router.post('/users/:id/unban', requirePermission('user:ban'), async (req, res) => {
        const user = await targetUser(req, res);
        if (!user) return;
        if (!user.bannedAt) {
            res.status(409).json({ message: 'This account isn’t suspended.' });
            return;
        }
        await User.updateOne({ _id: user._id }, { $set: { bannedAt: null, banReason: null, bannedBy: null } });
        await audit(req.user!.id, 'user.unbanned', user._id.toString());
        const updated = await User.findById(user._id).lean();
        res.json({ user: (await adminDTOs([updated!]))[0] });
    });

    router.post('/users/:id/revoke-sessions', requirePermission('user:ban'), async (req, res) => {
        const user = await targetUser(req, res);
        if (!user) return;
        if (user._id.toString() === req.user!.id) {
            res.status(422).json({ message: 'Use “Sign out everywhere” in Sessions for your own account.' });
            return;
        }
        const [count] = (await activeSessionCounts([user._id])).values();
        await sessions.revokeAllForUser(user._id.toString(), 'admin-revoked');
        await audit(req.user!.id, 'user.sessions_revoked', user._id.toString(), { sessions: String(count ?? 0) });
        const updated = await User.findById(user._id).lean();
        res.json({ user: (await adminDTOs([updated!]))[0] });
    });

    router.get('/videos', requirePermission('moderation:view'), async (req, res) => {
        const query = parseQuery(adminVideoListQuerySchema, req, res);
        if (!query) return;
        const filter: Record<string, unknown> = {};
        if (query.q) filter.title = new RegExp(escapeRegex(query.q), 'i');
        if (query.status === 'removed') filter.removedAt = { $ne: null };
        else if (query.status) filter.status = query.status;

        const [videos, total] = await Promise.all([
            Video.find(filter)
                .sort({ createdAt: -1, _id: -1 })
                .skip((query.page - 1) * query.pageSize)
                .limit(query.pageSize)
                .populate('owner', 'name username')
                .lean(),
            Video.countDocuments(filter),
        ]);
        const body: Page<AdminVideoDTO> = {
            items: videos.map((v) => toAdminVideoDTO(v as unknown as Parameters<typeof toAdminVideoDTO>[0])),
            total,
            page: query.page,
            pageSize: query.pageSize,
        };
        res.json(body);
    });

    async function moderatedVideo(req: Request, res: Response) {
        const { id } = req.params as { id: string };
        const video = isValidObjectId(id) ? await Video.findById(id).lean() : null;
        if (!video) res.status(404).json({ message: 'Video not found.' });
        return video;
    }
    async function adminVideo(id: Types.ObjectId) {
        const v = await Video.findById(id).populate('owner', 'name username').lean();
        return toAdminVideoDTO(v as unknown as Parameters<typeof toAdminVideoDTO>[0]);
    }

    /** Soft remove: hidden from everyone but the owner, who sees why. */
    router.post('/videos/:id/remove', requirePermission('video:moderate'), async (req, res) => {
        const input = parseOr422(removeVideoSchema, req.body, res);
        if (!input) return;
        const video = await moderatedVideo(req, res);
        if (!video) return;
        if (video.removedAt) {
            res.status(409).json({ message: 'This video is already removed.' });
            return;
        }
        await Video.updateOne(
            { _id: video._id },
            { $set: { removedAt: new Date(), removedBy: new Types.ObjectId(req.user!.id), removedReason: input.reason } },
        );
        await audit(req.user!.id, 'video.removed', video.owner.toString(), { reason: input.reason }, video._id.toString());
        res.json({ video: await adminVideo(video._id) });
    });

    router.post('/videos/:id/restore', requirePermission('video:moderate'), async (req, res) => {
        const video = await moderatedVideo(req, res);
        if (!video) return;
        if (!video.removedAt) {
            res.status(409).json({ message: 'This video isn’t removed.' });
            return;
        }
        await Video.updateOne({ _id: video._id }, { $set: { removedAt: null, removedBy: null, removedReason: null } });
        await audit(req.user!.id, 'video.restored', video.owner.toString(), {}, video._id.toString());
        res.json({ video: await adminVideo(video._id) });
    });

    /** Run the file check again on a video that failed it. */
    router.post('/videos/:id/reprocess', requirePermission('video:moderate'), async (req, res) => {
        const video = await moderatedVideo(req, res);
        if (!video) return;
        if (video.status !== 'failed' || video.uploadId) {
            res.status(409).json({ message: 'Only failed videos can be reprocessed.' });
            return;
        }
        if ((await storage.head(video.sourceKey)) === null) {
            res.status(409).json({ message: 'The source file is gone, so there’s nothing to check. The owner has to upload it again.' });
            return;
        }
        await Video.updateOne({ _id: video._id }, { $set: { status: 'processing', error: null, processedAt: null } });
        await jobs.enqueueProbe(video._id.toString());
        await audit(req.user!.id, 'video.reprocessed', video.owner.toString(), {}, video._id.toString());
        res.json({ video: await adminVideo(video._id) });
    });

    router.get('/audit', requirePermission('audit:view'), async (req, res) => {
        const query = parseQuery(auditListQuerySchema, req, res);
        if (!query) return;
        const filter: Record<string, unknown> = {};
        if (query.action) filter.action = query.action;
        if (query.target) {
            if (!isValidObjectId(query.target)) {
                sendValidationErrors(res, { target: 'Invalid user id' });
                return;
            }
            filter.target = new Types.ObjectId(query.target);
        }

        const [entries, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ createdAt: -1, _id: -1 })
                .skip((query.page - 1) * query.pageSize)
                .limit(query.pageSize)
                .populate('actor', 'name username')
                .populate('target', 'name username')
                .populate('video', 'title')
                .lean(),
            AuditLog.countDocuments(filter),
        ]);
        res.json({
            items: entries.map((e) => toAuditEntryDTO(e as unknown as Parameters<typeof toAuditEntryDTO>[0])),
            total,
            page: query.page,
            pageSize: query.pageSize,
        });
    });

    return router;
}
