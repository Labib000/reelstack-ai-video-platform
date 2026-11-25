import { type AdminVideoDTO, type OwnVideoDTO, VIDEO_STATUSES, VISIBILITIES, type VideoStatus, type Visibility } from '@reelstack/shared';
import type { Storage } from '../lib/storage.js';
import { type InferSchemaType, Schema, type Types, model } from 'mongoose';

const videoSchema = new Schema(
    {
        owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        title: { type: String, required: true, trim: true, maxlength: 120 },
        description: { type: String, default: '', maxlength: 5000 },
        visibility: { type: String, enum: VISIBILITIES, default: 'public' },
        status: { type: String, enum: VIDEO_STATUSES, default: 'uploading' },
        /** Plain-language reason processing failed. */
        error: { type: String, default: null },

        /** `uploads/{id}/source.{ext}`: the original file. */
        sourceKey: { type: String, required: true },
        /** Open S3 multipart upload; cleared once completed or aborted. */
        uploadId: { type: String, default: null },
        /** Bytes per multipart part (the client splits the file the same way). */
        partSize: { type: Number, required: true },
        sizeBytes: { type: Number, required: true },
        contentType: { type: String, required: true },
        originalName: { type: String, default: '' },

        // Filled in by the worker's ffprobe step.
        durationSec: { type: Number, default: null },
        width: { type: Number, default: null },
        height: { type: Number, default: null },
        videoCodec: { type: String, default: null },
        hasAudio: { type: Boolean, default: false },
        processedAt: { type: Date, default: null },

        // Filled in by the worker's transcode step.
        /** The run that owns this video's transcode; a newer run supersedes it. */
        transcodeRunId: { type: String, default: null },
        transcodeProgress: { type: Number, default: null },
        /** `hls/{id}/{runId}/`: playlists, one media file per quality, thumbnail. */
        hlsPrefix: { type: String, default: null },
        renditions: { type: [Number], default: [] },
        thumbnailKey: { type: String, default: null },

        // Moderation (soft remove: the owner still sees it, nobody else will).
        removedAt: { type: Date, default: null },
        removedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        removedReason: { type: String, default: null },

        views: { type: Number, default: 0 },
    },
    { timestamps: true, versionKey: false },
);
videoSchema.index({ owner: 1, createdAt: -1 });
videoSchema.index({ status: 1, createdAt: -1 });

export type VideoFields = InferSchemaType<typeof videoSchema> & { _id: Types.ObjectId; createdAt: Date };
export const Video = model('Video', videoSchema, 'videos');

/** Async because the thumbnail needs a signed URL. */
export async function toOwnVideoDTO(v: VideoFields, storage: Storage): Promise<OwnVideoDTO> {
    return {
        id: v._id.toString(),
        title: v.title,
        description: v.description ?? '',
        visibility: v.visibility as Visibility,
        status: v.status as VideoStatus,
        error: v.error ?? null,
        sizeBytes: v.sizeBytes,
        durationSec: v.durationSec ?? null,
        width: v.width ?? null,
        height: v.height ?? null,
        createdAt: v.createdAt.toISOString(),
        processedAt: v.processedAt?.toISOString() ?? null,
        transcodeProgress: v.transcodeProgress ?? null,
        renditions: v.renditions ?? [],
        thumbnailUrl: v.thumbnailKey ? await storage.signStable(v.thumbnailKey) : null,
        removedAt: v.removedAt?.toISOString() ?? null,
        removedReason: v.removedReason ?? null,
    };
}

type PopulatedOwner = { _id: Types.ObjectId; name: string; username?: string | null } | null;

export async function toAdminVideoDTO(v: Omit<VideoFields, 'owner'> & { owner: PopulatedOwner | Types.ObjectId }, storage: Storage): Promise<AdminVideoDTO> {
    const owner = v.owner && 'name' in v.owner ? v.owner : null;
    return {
        ...(await toOwnVideoDTO(v as unknown as VideoFields, storage)),
        owner: owner ? { id: owner._id.toString(), name: owner.name, username: owner.username ?? null } : null,
    };
}

/** File extension for the stored source, from the original name (falls back to the MIME subtype). */
export function sourceExtension(fileName: string, contentType: string): string {
    const fromName = /\.([a-z0-9]{1,5})$/i.exec(fileName)?.[1];
    const fromType = contentType.split('/')[1]?.replace(/^x-/, '').replace(/[^a-z0-9]/gi, '');
    return (fromName ?? fromType ?? 'bin').toLowerCase();
}
