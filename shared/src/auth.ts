import { z } from 'zod';

export const emailSchema = z.email().trim().toLowerCase().max(254);

export const passwordSchema = z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters');

export const registerSchema = z.object({
    name: z.string().trim().min(1, 'Name is required').max(60),
    email: emailSchema,
    password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const roleSchema = z.enum(['user', 'admin']);
export type Role = z.infer<typeof roleSchema>;

/** The user as the API returns it (never includes the password hash). */
export const userDtoSchema = z.object({
    id: z.string(),
    name: z.string(),
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
