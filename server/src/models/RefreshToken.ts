import { type InferSchemaType, Schema, type Types, model } from 'mongoose';

export const REVOKE_REASONS = [
    /** Replaced by a newer token during /refresh (the normal case). */
    'rotated',
    'logout',
    'logout-all',
    /** An already-rotated token was presented again: the family is burned. */
    'reuse',
    /** Signed out from the sessions list. */
    'session-revoked',
    /** The user no longer exists. */
    'user-missing',
    /** The account was suspended, or an admin signed it out everywhere. */
    'banned',
    'admin-revoked',
] as const;
export type RevokeReason = (typeof REVOKE_REASONS)[number];

/**
 * One refresh token. Only its SHA-256 hash is stored, so a database leak
 * doesn't hand out working tokens.
 *
 * A family is every token descended from one login (one device). Rotation
 * keeps the familyId, so revoking a family signs that device out.
 *
 * Revoked tokens stay until they expire (the TTL index deletes them): reuse
 * detection works by recognising a token that was already rotated.
 */
const refreshTokenSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        tokenHash: { type: String, required: true, unique: true },
        familyId: { type: String, required: true, index: true },
        /** When the login that started this family happened. */
        familyCreatedAt: { type: Date, required: true },
        expiresAt: { type: Date, required: true, expires: 0 },
        revokedAt: { type: Date, default: null },
        revokeReason: { type: String, enum: REVOKE_REASONS, default: null },
        /** Hash of the token that replaced this one. */
        replacedBy: { type: String, default: null },
        userAgent: { type: String, default: null },
        ip: { type: String, default: null },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        versionKey: false,
    },
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

export type RefreshTokenFields = InferSchemaType<typeof refreshTokenSchema> & {
    _id: Types.ObjectId;
};

export const RefreshToken = model(
    'RefreshToken',
    refreshTokenSchema,
    'refreshTokens',
);
