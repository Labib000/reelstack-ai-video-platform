import {
    type SignedPartDTO,
    UPLOAD_LIMITS,
    type UploadSessionDTO,
    can,
    completeUploadSchema,
    createUploadSchema,
    signPartsSchema,
    updateVideoSchema,
} from '@reelstack/shared';
import { type Request, type Response, Router } from 'express';
import type { Options } from 'express-rate-limit';
import { Types, isValidObjectId } from 'mongoose';

import type { Config } from '../config.js';
import type { Jobs } from '../lib/queue.js';
import type { Logger } from '../lib/logger.js';
import { rateLimitStore } from '../lib/rateLimitStore.js';
import type { Storage } from '../lib/storage.js';
import { perIpLimiter } from '../middleware/rateLimits.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { parseOr422, sendValidationErrors } from '../middleware/validate.js';
import { Video, sourceExtension, toOwnVideoDTO } from '../models/Video.js';

const HOUR_MS = 3_600_000;
const MIN_PART = 10 * 1024 * 1024;
/** S3 allows at most 10 000 parts per upload. */
const MAX_PARTS = 10_000;

/** 10 MB parts, bigger only when a file would need more than 10 000 of them. */
export function partSizeFor(sizeBytes: number): number {
    return Math.max(MIN_PART, Math.ceil(sizeBytes / MAX_PARTS));
}

export function createVideosRouter(config: Config, logger: Logger, storage: Storage, jobs: Jobs): Router {
    const router = Router();
    router.use(requireAuth(config));

    const dailyUploads = rateLimitStore('upload-day');
    dailyUploads.init!({ windowMs: 24 * HOUR_MS } as Options);

    /**
     * The :id video if the caller owns it (or, with `moderators`, may moderate
     * it). Anyone else gets a 404, so ids of private videos don't leak.
     */
    async function ownVideo(req: Request, res: Response, { moderators = false } = {}) {
        const { id } = req.params as { id: string };
        const video = isValidObjectId(id) ? await Video.findById(id).lean() : null;
        const allowed =
            video && (video.owner.toString() === req.user!.id || (moderators && can(req.user!.role, 'video:moderate')));
        if (!video || !allowed) {
            res.status(404).json({ message: 'Video not found.' });
            return null;
        }
        return video;
    }

    /** Start an upload: checks quotas, creates the Video, opens the multipart upload. */
    router.post('/', perIpLimiter('upload-create', 30, HOUR_MS), async (req, res) => {
        const input = parseOr422(createUploadSchema, req.body, res);
        if (!input) return;
        if (input.sizeBytes > config.UPLOAD_MAX_BYTES) {
            sendValidationErrors(res, { sizeBytes: `Videos can be up to ${Math.round(config.UPLOAD_MAX_BYTES / 1024 ** 3)} GB` });
            return;
        }

        const owner = new Types.ObjectId(req.user!.id);
        const _id = new Types.ObjectId();
        const sourceKey = `uploads/${_id}/source.${sourceExtension(input.fileName, input.contentType)}`;
        const partSize = partSizeFor(input.sizeBytes);

        // Reserve a slot first, then count: parallel requests can't slip past the limit.
        const video = await Video.create({
            _id,
            owner,
            title: input.title,
            description: input.description,
            visibility: input.visibility,
            sourceKey,
            partSize,
            sizeBytes: input.sizeBytes,
            contentType: input.contentType,
            originalName: input.fileName,
        });
        let uploadId: string | null = null;
        try {
            if ((await Video.countDocuments({ owner, status: 'uploading' })) > UPLOAD_LIMITS.maxInProgress) {
                await Video.deleteOne({ _id });
                res.status(429).json({ message: `You can have ${UPLOAD_LIMITS.maxInProgress} uploads in progress at once. Finish or cancel one first.` });
                return;
            }
            // A counter, not a document count: deleting videos doesn't refill the quota.
            if ((await dailyUploads.increment(req.user!.id)).totalHits > UPLOAD_LIMITS.maxPerDay) {
                await Video.deleteOne({ _id });
                res.status(429).json({ message: `You’ve reached today’s limit of ${UPLOAD_LIMITS.maxPerDay} uploads. Try again tomorrow.` });
                return;
            }
            uploadId = await storage.createMultipart(sourceKey, input.contentType);
            await Video.updateOne({ _id }, { $set: { uploadId } });
        } catch (error) {
            await Promise.allSettled([Video.deleteOne({ _id }), uploadId ? storage.abort(sourceKey, uploadId) : null]);
            throw error;
        }
        logger.info({ videoId: _id.toString(), sizeBytes: input.sizeBytes }, 'Upload started');

        const body: UploadSessionDTO = {
            video: toOwnVideoDTO(video.toObject()),
            partSize,
            partCount: Math.ceil(input.sizeBytes / partSize),
        };
        res.status(201).json(body);
    });

    /** Presigned URLs for some parts (the client asks in batches as it goes). */
    router.post('/:id/parts', async (req, res) => {
        const input = parseOr422(signPartsSchema, req.body, res);
        if (!input) return;
        const video = await ownVideo(req, res);
        if (!video) return;
        if (video.status !== 'uploading' || !video.uploadId) {
            res.status(409).json({ message: 'This upload is already finished.' });
            return;
        }
        const partCount = Math.ceil(video.sizeBytes / video.partSize);
        if (input.partNumbers.some((n) => n > partCount)) {
            sendValidationErrors(res, { partNumbers: `This upload has ${partCount} parts.` });
            return;
        }
        const parts: SignedPartDTO[] = await Promise.all(
            input.partNumbers.map(async (partNumber) => ({
                partNumber,
                url: await storage.signPart(video.sourceKey, video.uploadId!, partNumber),
            })),
        );
        res.json({ parts });
    });

    /** All parts are up: stitch them together, verify, and queue the file check. */
    router.post('/:id/complete', async (req, res) => {
        const input = parseOr422(completeUploadSchema, req.body, res);
        if (!input) return;
        const video = await ownVideo(req, res);
        if (!video) return;
        if (video.status !== 'uploading' || !video.uploadId) {
            res.status(409).json({ message: 'This upload is already finished.' });
            return;
        }

        const partCount = Math.ceil(video.sizeBytes / video.partSize);
        const numbers = [...new Set(input.parts.map((p) => p.partNumber))].sort((a, b) => a - b);
        if (numbers.length !== partCount || numbers[0] !== 1 || numbers.at(-1) !== partCount) {
            sendValidationErrors(res, { parts: `Expected ${partCount} parts, got ${numbers.length}. Some parts didn’t upload.` });
            return;
        }

        // Claim it: of two simultaneous requests only one gets to assemble the file.
        const { uploadId } = video;
        const claimed = await Video.updateOne({ _id: video._id, status: 'uploading', uploadId }, { $set: { status: 'processing', uploadId: null } });
        if (claimed.modifiedCount === 0) {
            res.status(409).json({ message: 'This upload is already finished.' });
            return;
        }

        const parts = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);
        try {
            await storage.complete(video.sourceKey, uploadId, parts);
        } catch (error) {
            await Video.updateOne({ _id: video._id }, { $set: { status: 'uploading', uploadId } });
            logger.warn({ err: error, videoId: video._id.toString() }, 'CompleteMultipartUpload failed');
            sendValidationErrors(res, { parts: 'Storage couldn’t assemble the file. Please upload it again.' });
            return;
        }

        // Trust the bytes in storage, not the size the client claimed.
        const size = await storage.head(video.sourceKey);
        if (size !== video.sizeBytes) {
            await storage.deletePrefix(`uploads/${video._id}/`);
            await Video.updateOne(
                { _id: video._id },
                { $set: { status: 'failed', uploadId: null, error: 'The upload was incomplete. Please try again.' } },
            );
            sendValidationErrors(res, { parts: 'The uploaded file is not the expected size.' });
            return;
        }

        const updated = await Video.findById(video._id).lean();
        if (!updated) {
            // Deleted while we were assembling it.
            await storage.deletePrefix(`uploads/${video._id}/`);
            res.status(404).json({ message: 'Video not found.' });
            return;
        }
        try {
            await jobs.enqueueProbe(video._id.toString());
        } catch (error) {
            // The file is safe; the worker's hourly sweep queues the check again.
            logger.error({ err: error, videoId: video._id.toString() }, 'Could not queue the probe');
        }
        logger.info({ videoId: video._id.toString() }, 'Upload complete');
        res.json({ video: toOwnVideoDTO(updated) });
    });

    /** Cancel an upload in progress: abort it in storage and forget the video. */
    router.delete('/:id/upload', async (req, res) => {
        const video = await ownVideo(req, res);
        if (!video) return;
        if (video.status !== 'uploading') {
            res.status(409).json({ message: 'This upload already finished. Delete the video instead.' });
            return;
        }
        if (video.uploadId) await storage.abort(video.sourceKey, video.uploadId);
        await Video.deleteOne({ _id: video._id });
        res.status(204).end();
    });

    router.get('/mine', async (req, res) => {
        const videos = await Video.find({ owner: new Types.ObjectId(req.user!.id) }).sort({ createdAt: -1 }).limit(200).lean();
        res.json({ videos: videos.map(toOwnVideoDTO) });
    });

    router.get('/:id', async (req, res) => {
        const video = await ownVideo(req, res, { moderators: true });
        if (!video) return;
        res.json({ video: toOwnVideoDTO(video) });
    });

    router.patch('/:id', async (req, res) => {
        const input = parseOr422(updateVideoSchema, req.body, res);
        if (!input) return;
        const video = await ownVideo(req, res);
        if (!video) return;
        const updated = await Video.findByIdAndUpdate(video._id, { $set: input }, { returnDocument: 'after' }).lean();
        res.json({ video: toOwnVideoDTO(updated!) });
    });

    /** Delete for good: the open upload, the source file and any renditions. */
    router.delete('/:id', async (req, res) => {
        const video = await ownVideo(req, res);
        if (!video) return;
        if (video.uploadId) await storage.abort(video.sourceKey, video.uploadId);
        await Promise.all([storage.deletePrefix(`uploads/${video._id}/`), storage.deletePrefix(`hls/${video._id}/`)]);
        await Video.deleteOne({ _id: video._id });
        res.status(204).end();
    });

    return router;
}
