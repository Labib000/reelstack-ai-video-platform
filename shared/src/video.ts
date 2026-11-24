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
