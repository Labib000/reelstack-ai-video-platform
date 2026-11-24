import { z } from 'zod';

export const emailSchema = z.email().trim().toLowerCase().max(254);

/** New passwords: 8–128 characters with at least one letter and one number. */
export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/\p{L}/u, 'Password must include a letter')
    .regex(/\d/, 'Password must include a number');

/** Handles that would confuse people or impersonate the site. */
export const RESERVED_USERNAMES = ['admin', 'administrator', 'api', 'moderator', 'reelstack', 'root', 'support', 'system'];

/** The public @handle: lowercase letters, digits, `_` and `.`, starting with a letter. */
export const usernameSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-z][a-z0-9_.]*$/, 'Use lowercase letters, numbers, _ or ., starting with a letter')
    .refine((u) => !RESERVED_USERNAMES.includes(u), 'That username is reserved');

/** Youngest age allowed to sign up (the usual platform minimum). */
export const MIN_AGE = 13;

/** Whole years between `dob` and `now` (both read as UTC dates). */
export function ageOn(dob: Date, now: Date = new Date()): number {
    let age = now.getUTCFullYear() - dob.getUTCFullYear();
    const months = now.getUTCMonth() - dob.getUTCMonth();
    if (months < 0 || (months === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
    return age;
}

/** `YYYY-MM-DD`, a real calendar date, after 1900, at least MIN_AGE years ago. */
export const dateOfBirthSchema = z
    .string({ error: 'Enter your date of birth' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter your date of birth')
    .superRefine((value, ctx) => {
        const date = new Date(`${value}T00:00:00Z`);
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
            ctx.addIssue({ code: 'custom', message: 'That date doesn’t exist' });
        } else if (date.getUTCFullYear() < 1900) {
            ctx.addIssue({ code: 'custom', message: 'Enter a year after 1900' });
        } else if (date.getTime() > Date.now()) {
            ctx.addIssue({ code: 'custom', message: 'Date of birth can’t be in the future' });
        } else if (ageOn(date) < MIN_AGE) {
            ctx.addIssue({ code: 'custom', message: `You must be at least ${MIN_AGE} to use ReelStack` });
        }
    });

export const INTERESTS = ['Programming', 'Science', 'Design', 'Film & editing', 'Food', 'Business', 'Photography', 'Music'] as const;
export type Interest = (typeof INTERESTS)[number];

export const interestsSchema = z
    .array(z.enum(INTERESTS))
    .min(1, 'Pick at least one topic')
    .max(5, 'Pick up to 5 topics')
    .refine((list) => new Set(list).size === list.length, 'Each topic only once');

export const registerSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(60),
    username: usernameSchema,
    email: emailSchema,
    password: passwordSchema,
    dateOfBirth: dateOfBirthSchema,
    interests: interestsSchema,
    acceptTerms: z.literal(true, { error: 'You need to accept the Terms of Service and Privacy Policy' }),
    /** Product news emails; off unless ticked. */
    marketingOptIn: z.boolean().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * user: watches, uploads, comments; manages only their own content.
 * moderator: also removes any video or comment and hides users' content.
 * admin: everything, including bans and changing roles.
 */
export const ROLES = ['user', 'moderator', 'admin'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

/** The user as the API returns it (never includes the password hash). */
export const userDtoSchema = z.object({
    id: z.string(),
    name: z.string(),
    /** Null for accounts created before usernames existed. */
    username: z.string().nullable(),
    email: z.string(),
    role: roleSchema,
    avatarUrl: z.string().nullable(),
    createdAt: z.string(),
});
export type UserDTO = z.infer<typeof userDtoSchema>;

/** Body of a successful login, register or refresh. */
export const authResponseSchema = z.object({
    accessToken: z.string(),
    user: userDtoSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** One signed-in device: a refresh-token family. */
export const sessionDtoSchema = z.object({
    familyId: z.string(),
    userAgent: z.string().nullable(),
    ip: z.string().nullable(),
    createdAt: z.string(),
    lastUsedAt: z.string(),
    current: z.boolean(),
});
export type SessionDTO = z.infer<typeof sessionDtoSchema>;

/** GET /api/auth/username-available response. */
export const usernameAvailabilitySchema = z.object({
    available: z.boolean(),
    /** Why it's unavailable: invalid format, reserved or taken. */
    reason: z.string().optional(),
});
export type UsernameAvailability = z.infer<typeof usernameAvailabilitySchema>;
