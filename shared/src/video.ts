import { z } from 'zod';

/**
 * The video API contract. The client builds against these now (with
 * placeholder data); the Phase 2+ endpoints return exactly these shapes.
 */
export const VIDEO_STATUSES = ['uploading', 'processing', 'ready', 'failed'] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export const VISIBILITIES = ['public', 'unlisted', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export interface ChannelDTO {
    id: string;
    name: string;
    handle: string;
    avatarUrl: string | null;
}

export interface ChapterDTO {
    /** Seconds from the start. */
    start: number;
    title: string;
}

export interface VideoSummaryDTO {
    id: string;
    title: string;
    durationSec: number;
    views: number;
    createdAt: string;
    category: string;
    status: VideoStatus;
    visibility: Visibility;
    /** Null until the worker has made one; the client draws a poster instead. */
    thumbnailUrl: string | null;
    channel: ChannelDTO;
    /** One-paragraph AI summary (Phase 5); null until generated. */
    summary: string | null;
}

export interface VideoDetailDTO extends VideoSummaryDTO {
    description: string;
    chapters: ChapterDTO[];
    likes: number;
    /** Signed HLS master playlist URL (Phase 3). */
    hlsUrl: string | null;
}

export interface TranscriptSegment {
    start: number;
    end: number;
    text: string;
}

/** A search hit inside a video: "at 12:04 in X, someone says …". */
export interface MomentDTO {
    video: VideoSummaryDTO;
    start: number;
    snippet: string;
}

export const askRequestSchema = z.object({
    question: z.string().trim().min(3, 'Ask a little more').max(500),
});
export type AskRequest = z.infer<typeof askRequestSchema>;

/** What "Ask the Video" returns; the LLM output is validated against this. */
export const askAnswerSchema = z.object({
    answer: z.string(),
    /** False when the video doesn't cover the question. */
    covered: z.boolean(),
    citations: z.array(z.object({ start: z.number().nonnegative(), quote: z.string() })),
});
export type AskAnswer = z.infer<typeof askAnswerSchema>;

// ── Uploads (Phase 2) ────────────────────────────────────────────────────

/** Limits enforced by the API; shared so the client can pre-check. */
export const UPLOAD_LIMITS = {
    maxBytes: 5 * 1024 ** 3,
    /** Uploads still in the `uploading` state at once, per user. */
    maxInProgress: 3,
    /** New uploads per user per rolling 24 hours. */
    maxPerDay: 10,
} as const;

const visibilitySchema = z.enum(VISIBILITIES);
const titleSchema = z.string().trim().min(1, 'Give the video a title').max(120, 'Keep the title under 120 characters');
const descriptionSchema = z.string().trim().max(5000, 'Keep the description under 5000 characters');

export const createUploadSchema = z.object({
    fileName: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().min(1, 'The file is empty').max(UPLOAD_LIMITS.maxBytes, 'Videos can be up to 5 GB'),
    contentType: z.string().regex(/^video\/[\w.+-]+$/, 'That isn’t a video file'),
    title: titleSchema,
    description: descriptionSchema.default(''),
    visibility: visibilitySchema.default('public'),
});
export type CreateUploadInput = z.input<typeof createUploadSchema>;

export const signPartsSchema = z.object({
    partNumbers: z.array(z.number().int().min(1).max(10_000)).min(1).max(20),
});

export const completeUploadSchema = z.object({
    parts: z
        .array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1).max(200) }))
        .min(1)
        .max(10_000),
});
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

export const updateVideoSchema = z
    .object({ title: titleSchema, description: descriptionSchema, visibility: visibilitySchema })
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;

/** One of your own videos, as the uploader sees it. */
export interface OwnVideoDTO {
    id: string;
    title: string;
    description: string;
    visibility: Visibility;
    status: VideoStatus;
    /** Why processing failed, in plain words. */
    error: string | null;
    sizeBytes: number;
    durationSec: number | null;
    width: number | null;
    height: number | null;
    createdAt: string;
    /** When the file check (ffprobe) finished. */
    processedAt: string | null;
    /** Taken down by a moderator. */
    removedAt: string | null;
    removedReason: string | null;
}

export interface AdminVideoDTO extends OwnVideoDTO {
    owner: { id: string; name: string; username: string | null } | null;
}

/** POST /api/videos response: where and how to send the file. */
export interface UploadSessionDTO {
    video: OwnVideoDTO;
    /** Bytes per part (the last part may be smaller). */
    partSize: number;
    partCount: number;
}

export interface SignedPartDTO {
    partNumber: number;
    url: string;
}

export const ADMIN_VIDEO_STATUSES = ['uploading', 'processing', 'ready', 'failed', 'removed'] as const;

export const adminVideoListQuerySchema = z.object({
    q: z.string().trim().max(100).optional(),
    status: z.enum(ADMIN_VIDEO_STATUSES).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminVideoListQuery = z.input<typeof adminVideoListQuerySchema>;

export const removeVideoSchema = z.object({
    reason: z.string().trim().min(3, 'Give a short reason (3+ characters)').max(200),
});
