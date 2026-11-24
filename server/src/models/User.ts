import { ROLES, type Role, type UserDTO } from '@reelstack/shared';
import { type InferSchemaType, Schema, type Types, model } from 'mongoose';

const userSchema = new Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        /**
         * Public @handle. Not mongoose-required so accounts made before
         * usernames existed still save; registerSchema requires it for new
         * signups. Sparse so those older accounts don't collide on null.
         */
        username: {
            type: String,
            lowercase: true,
            trim: true,
            maxlength: 30,
            unique: true,
            sparse: true,
        },
        dateOfBirth: { type: Date },
        interests: { type: [String], default: [] },
        termsAcceptedAt: { type: Date },
        marketingOptIn: { type: Boolean, default: false },
        /** argon2id hash. Never selected unless asked for (login only). */
        passwordHash: { type: String, required: true, select: false },
        role: {
            type: String,
            enum: ROLES,
            default: 'user',
        },
        avatarUrl: { type: String, default: null },
        /**
         * Copied into every access token as `tv`. logout-all increments it, so
         * access tokens issued before then fail requireAuth's check at once
         * instead of living out their 15 minutes.
         */
        tokenVersion: { type: Number, default: 0 },
    },
    { timestamps: true, versionKey: false },
);

export type UserFields = InferSchemaType<typeof userSchema> & {
    _id: Types.ObjectId;
};

export const User = model('User', userSchema, 'users');

export function toUserDTO(
    user: Pick<
        UserFields,
        '_id' | 'name' | 'email' | 'role' | 'avatarUrl' | 'createdAt'
    > & { username?: string | null },
): UserDTO {
    return {
        id: user._id.toString(),
        name: user.name,
        username: user.username ?? null,
        email: user.email,
        role: user.role as Role,
        avatarUrl: user.avatarUrl ?? null,
        createdAt: user.createdAt.toISOString(),
    };
}
