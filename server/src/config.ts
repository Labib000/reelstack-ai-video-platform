import { z } from 'zod';

const optionalString = z
    .string()
    .trim()
    .transform((value) => (value === '' ? undefined : value))
    .optional();

const envSchema = z.object({
    NODE_ENV: z
        .enum(['development', 'test', 'production'])
        .default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    APP_URL: z.url().default('http://localhost:5173'),
    // `LOG_LEVEL=` (blank, as in .env.example) means unset.
    LOG_LEVEL: z.preprocess(
        (value) =>
            typeof value === 'string' && value.trim() === ''
                ? undefined
                : value,
        z
            .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
            .optional(),
    ),

    MONGO_URI: z
        .string()
        .trim()
        .min(1, 'MONGO_URI is required (see .env.example)')
        .refine(
            (uri) =>
                uri.startsWith('mongodb://') ||
                uri.startsWith('mongodb+srv://'),
            'MONGO_URI must start with mongodb:// or mongodb+srv://',
        ),
    /** Optional: unset means Redis features fall back or are skipped. */
    REDIS_URL: optionalString.refine(
        (url) => url === undefined || /^rediss?:\/\//.test(url),
        'REDIS_URL must start with redis:// or rediss://',
    ),

    JWT_ACCESS_SECRET: z
        .string({ error: 'JWT_ACCESS_SECRET is required (see .env.example)' })
        .trim()
        .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

    S3_ENDPOINT: optionalString,
    S3_REGION: z.string().trim().default('auto'),
    S3_BUCKET: z.string().trim().default('reelstack'),
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    /** Where browsers reach storage (presigned URLs are signed for it). Defaults to S3_ENDPOINT. */
    S3_PUBLIC_ENDPOINT: optionalString,
    UPLOAD_MAX_BYTES: z.preprocess(
        (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
        z.coerce.number().int().positive().default(5 * 1024 ** 3),
    ),

    GROQ_API_KEY: optionalString,
});

export type Config = z.infer<typeof envSchema>;

/** Parses env vars, throwing one readable error listing every problem. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const result = envSchema.safeParse(env);
    if (!result.success) {
        const lines = result.error.issues.map(
            (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
        );
        throw new Error(`Invalid environment:\n${lines.join('\n')}`);
    }
    return result.data;
}
