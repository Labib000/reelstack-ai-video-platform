import { randomUUID } from 'node:crypto';

import type { Role, SessionDTO } from '@reelstack/shared';
import { Types } from 'mongoose';

import type { Config } from '../config.js';
import type { Logger } from '../lib/logger.js';
import { RefreshToken, type RevokeReason } from '../models/RefreshToken.js';
import { User } from '../models/User.js';
import { generateRefreshToken, hashToken, signAccessToken } from './tokens.js';

/** The refresh token is missing, unknown, expired, revoked or reused. */
export class InvalidRefreshError extends Error {
    override name = 'InvalidRefreshError';
}

/** Where a request came from, stored on each token for the sessions list. */
export interface ClientContext {
    userAgent: string | null;
    ip: string | null;
}

export interface SessionUser {
    _id: Types.ObjectId;
    role: string;
    tokenVersion: number;
}

export interface IssuedTokens {
    accessToken: string;
    /** Raw token for the cookie. Only its hash is in the database. */
    refreshToken: string;
    familyId: string;
    userId: string;
}

const DAY_MS = 86_400_000;

type AuthConfig = Pick<
    Config,
    'JWT_ACCESS_SECRET' | 'ACCESS_TOKEN_TTL_SEC' | 'REFRESH_TOKEN_TTL_DAYS'
>;

/**
 * Refresh-token rotation with reuse detection.
 *
 * Every /refresh revokes the presented token and issues a new one in the same
 * family. A legitimate client only ever holds the newest token, so if an
 * already-rotated token shows up again, either it was stolen or the thief
 * already used it: the whole family is revoked and both parties must log in.
 */
export class RefreshService {
    constructor(
        private readonly config: AuthConfig,
        private readonly logger: Logger,
    ) {}

    accessTokenFor(user: SessionUser): string {
        return signAccessToken(
            {
                sub: user._id.toString(),
                role: user.role as Role,
                tv: user.tokenVersion,
            },
            this.config.JWT_ACCESS_SECRET,
            this.config.ACCESS_TOKEN_TTL_SEC,
        );
    }

    /** Starts a new family (a login), or continues one (a rotation). */
    async issueSession(
        user: SessionUser,
        ctx: ClientContext,
        family?: { familyId: string; familyCreatedAt: Date },
    ): Promise<IssuedTokens> {
        const now = new Date();
        const refreshToken = generateRefreshToken();
        const familyId = family?.familyId ?? randomUUID();

        await RefreshToken.create({
            userId: user._id,
            tokenHash: hashToken(refreshToken),
            familyId,
            familyCreatedAt: family?.familyCreatedAt ?? now,
            expiresAt: new Date(
                now.getTime() + this.config.REFRESH_TOKEN_TTL_DAYS * DAY_MS,
            ),
            userAgent: ctx.userAgent,
            ip: ctx.ip,
        });

        return {
            accessToken: this.accessTokenFor(user),
            refreshToken,
            familyId,
            userId: user._id.toString(),
        };
    }

    /**
     * Swaps a refresh token for a new access + refresh token pair.
     *
     * The new token is inserted *before* the old one is claimed. If two
     * requests race with the same token, the loser's claim fails and it
     * revokes the family, and by then the winner's new token already exists,
     * so the revoke catches it too. Clients must therefore never refresh
     * twice in parallel (the client serialises refreshes).
     */
    async rotate(raw: string, ctx: ClientContext): Promise<IssuedTokens> {
        const presented = await RefreshToken.findOne({
            tokenHash: hashToken(raw),
        }).lean();

        if (!presented) throw new InvalidRefreshError('Unknown refresh token');

        if (presented.revokedAt) {
            // Only a token that was rotated away signals theft. One revoked by
            // logout (or already burned by reuse) is just invalid.
            if (presented.revokeReason === 'rotated') {
                await this.handleReuse(presented.familyId, presented.userId, ctx);
            }
            throw new InvalidRefreshError('Refresh token was revoked');
        }

        if (presented.expiresAt.getTime() <= Date.now()) {
            throw new InvalidRefreshError('Refresh token expired');
        }

        const user = await User.findById(presented.userId)
            .select('role tokenVersion bannedAt')
            .lean();
        if (!user) {
            await this.revokeFamily(presented.familyId, 'user-missing');
            throw new InvalidRefreshError('User no longer exists');
        }
        if (user.bannedAt) {
            await this.revokeFamily(presented.familyId, 'banned');
            throw new InvalidRefreshError('Account is suspended');
        }

        const next = await this.issueSession(user, ctx, {
            familyId: presented.familyId,
            familyCreatedAt: presented.familyCreatedAt,
        });

        // Atomic claim: only one request can flip revokedAt from null.
        const claimed = await RefreshToken.findOneAndUpdate(
            { _id: presented._id, revokedAt: null },
            {
                $set: {
                    revokedAt: new Date(),
                    revokeReason: 'rotated',
                    replacedBy: hashToken(next.refreshToken),
                },
            },
        ).lean();

        if (!claimed) {
            await this.handleReuse(presented.familyId, presented.userId, ctx);
            throw new InvalidRefreshError('Refresh token was already used');
        }

        return next;
    }

    private async handleReuse(
        familyId: string,
        userId: Types.ObjectId,
        ctx: ClientContext,
    ): Promise<void> {
        const revoked = await this.revokeFamily(familyId, 'reuse');
        this.logger.warn(
            {
                event: 'refresh_token_reuse',
                userId: userId.toString(),
                familyId,
                ip: ctx.ip,
                userAgent: ctx.userAgent,
                revoked,
            },
            'Refresh token reuse detected; family revoked',
        );
    }

    /** Revokes every live token in a family. Returns how many. */
    async revokeFamily(
        familyId: string,
        reason: RevokeReason,
        userId?: string,
    ): Promise<number> {
        const result = await RefreshToken.updateMany(
            {
                familyId,
                revokedAt: null,
                ...(userId ? { userId: new Types.ObjectId(userId) } : {}),
            },
            { $set: { revokedAt: new Date(), revokeReason: reason } },
        );
        return result.modifiedCount;
    }

    /** Signs out of a family by the raw cookie token (logout). */
    async revokeByToken(raw: string, reason: RevokeReason): Promise<void> {
        const token = await RefreshToken.findOne({ tokenHash: hashToken(raw) })
            .select('familyId')
            .lean();
        if (token) await this.revokeFamily(token.familyId, reason);
    }

    /** The family a raw cookie token belongs to, if it's known. */
    async familyOf(raw: string | undefined): Promise<string | null> {
        if (!raw) return null;
        const token = await RefreshToken.findOne({ tokenHash: hashToken(raw) })
            .select('familyId')
            .lean();
        return token?.familyId ?? null;
    }

    /**
     * logout-all: revokes every family and bumps tokenVersion, so access
     * tokens already handed out stop working at the next request.
     */
    async revokeAllForUser(userId: string, reason: RevokeReason = 'logout-all'): Promise<void> {
        const id = new Types.ObjectId(userId);
        await RefreshToken.updateMany(
            { userId: id, revokedAt: null },
            { $set: { revokedAt: new Date(), revokeReason: reason } },
        );
        await User.updateOne({ _id: id }, { $inc: { tokenVersion: 1 } });
    }

    /** True when the user has (or had) a token in this family. */
    async familyBelongsTo(familyId: string, userId: string): Promise<boolean> {
        const found = await RefreshToken.exists({
            familyId,
            userId: new Types.ObjectId(userId),
        });
        return found !== null;
    }

    /** One row per signed-in device: the newest live token of each family. */
    async listSessions(
        userId: string,
        currentFamilyId: string | null,
    ): Promise<SessionDTO[]> {
        const rows = await RefreshToken.aggregate<{
            _id: string;
            userAgent: string | null;
            ip: string | null;
            familyCreatedAt: Date;
            lastUsedAt: Date;
        }>([
            {
                $match: {
                    userId: new Types.ObjectId(userId),
                    revokedAt: null,
                    expiresAt: { $gt: new Date() },
                },
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$familyId',
                    userAgent: { $first: '$userAgent' },
                    ip: { $first: '$ip' },
                    familyCreatedAt: { $first: '$familyCreatedAt' },
                    lastUsedAt: { $first: '$createdAt' },
                },
            },
            { $sort: { lastUsedAt: -1 } },
        ]);

        return rows.map((row) => ({
            familyId: row._id,
            userAgent: row.userAgent,
            ip: row.ip,
            createdAt: row.familyCreatedAt.toISOString(),
            lastUsedAt: row.lastUsedAt.toISOString(),
            current: row._id === currentFamilyId,
        }));
    }
}
