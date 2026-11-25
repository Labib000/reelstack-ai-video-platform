/**
 * Object storage for video files: RustFS locally, Cloudflare R2 in
 * production (both speak S3). Browsers upload straight to it with presigned
 * multipart URLs, so video bytes never pass through the API.
 */
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, readFile, stat, writeFile } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import {
    AbortMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    CreateMultipartUploadCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    S3Client,
    UploadPartCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import type { Config } from '../config.js';

export interface Storage {
    createMultipart(key: string, contentType: string): Promise<string>;
    signPart(key: string, uploadId: string, partNumber: number, expiresSec?: number): Promise<string>;
    complete(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void>;
    abort(key: string, uploadId: string): Promise<void>;
    /** Size in bytes, or null when the object doesn't exist. */
    head(key: string): Promise<number | null>;
    /** A short-lived GET URL (the worker hands it to ffprobe). */
    signGet(key: string, expiresSec?: number, internal?: boolean): Promise<string>;
    /** A browser GET URL that stays the same for half an hour, so images stay cached. */
    signStable(key: string): Promise<string>;
    downloadTo(key: string, path: string, signal?: AbortSignal): Promise<void>;
    putFile(key: string, path: string, contentType: string, signal?: AbortSignal): Promise<void>;
    getText(key: string): Promise<string>;
    /** Deletes every object under a prefix; returns how many. */
    deletePrefix(prefix: string): Promise<number>;
}

export class S3Storage implements Storage {
    private readonly client: S3Client;
    /** Signs URLs for the host browsers use (may differ from the API's). */
    private readonly publicClient: S3Client;

    constructor(private readonly config: Config) {
        const base = {
            region: config.S3_REGION,
            forcePathStyle: true,
            credentials:
                config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY
                    ? { accessKeyId: config.S3_ACCESS_KEY_ID, secretAccessKey: config.S3_SECRET_ACCESS_KEY }
                    : undefined,
            // RustFS and R2 don't need the newer default checksums on presigned PUTs.
            requestChecksumCalculation: 'WHEN_REQUIRED' as const,
            responseChecksumValidation: 'WHEN_REQUIRED' as const,
        };
        this.client = new S3Client({ ...base, endpoint: config.S3_ENDPOINT });
        this.publicClient = new S3Client({ ...base, endpoint: config.S3_PUBLIC_ENDPOINT ?? config.S3_ENDPOINT });
    }

    private get bucket() {
        return this.config.S3_BUCKET;
    }

    async createMultipart(key: string, contentType: string) {
        const res = await this.client.send(new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }));
        if (!res.UploadId) throw new Error('Storage did not return an UploadId');
        return res.UploadId;
    }

    signPart(key: string, uploadId: string, partNumber: number, expiresSec = 3600) {
        return getSignedUrl(this.publicClient, new UploadPartCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }), {
            expiresIn: expiresSec,
        });
    }

    async complete(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
        await this.client.send(
            new CompleteMultipartUploadCommand({
                Bucket: this.bucket,
                Key: key,
                UploadId: uploadId,
                MultipartUpload: { Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })) },
            }),
        );
    }

    async abort(key: string, uploadId: string) {
        try {
            await this.client.send(new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }));
        } catch (error) {
            // Already completed or aborted: nothing left to clean up.
            if ((error as { name?: string }).name !== 'NoSuchUpload') throw error;
        }
    }

    async head(key: string) {
        try {
            const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
            return res.ContentLength ?? 0;
        } catch (error) {
            const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
            if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return null;
            throw error;
        }
    }

    signGet(key: string, expiresSec = 900, internal = true) {
        return getSignedUrl(internal ? this.client : this.publicClient, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresSec });
    }

    signStable(key: string) {
        const step = 30 * 60_000;
        return getSignedUrl(this.publicClient, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
            expiresIn: 2 * 3600,
            signingDate: new Date(Math.floor(Date.now() / step) * step),
        });
    }

    async downloadTo(key: string, path: string, signal?: AbortSignal) {
        const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), { abortSignal: signal });
        await pipeline(res.Body as Readable, createWriteStream(path), { signal });
    }

    /** Multipart, because a long 1080p file can pass the 5 GB single-PUT limit. */
    async putFile(key: string, path: string, contentType: string, signal?: AbortSignal) {
        const upload = new Upload({
            client: this.client,
            params: { Bucket: this.bucket, Key: key, Body: createReadStream(path), ContentType: contentType },
            partSize: Math.max(16 * 1024 ** 2, Math.ceil((await stat(path)).size / 9000)),
            queueSize: 3,
        });
        const abort = () => void upload.abort();
        signal?.throwIfAborted();
        signal?.addEventListener('abort', abort, { once: true });
        try {
            await upload.done();
        } finally {
            signal?.removeEventListener('abort', abort);
        }
    }

    async getText(key: string) {
        const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
        return res.Body!.transformToString();
    }

    async deletePrefix(prefix: string) {
        let deleted = 0;
        let token: string | undefined;
        do {
            const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
            const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
            if (keys.length) {
                await this.client.send(new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys, Quiet: true } }));
                deleted += keys.length;
            }
            token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
        return deleted;
    }
}

/** In-memory stand-in for tests: tracks uploads and objects, no network. */
export class MemoryStorage implements Storage {
    readonly uploads = new Map<string, { key: string; contentType: string }>();
    readonly objects = new Map<string, number>();
    /** Size the next completed object will have (tests set it to simulate the upload). */
    nextSize = new Map<string, number>();
    private seq = 0;

    async createMultipart(key: string, contentType: string) {
        const id = `upload-${++this.seq}`;
        this.uploads.set(id, { key, contentType });
        return id;
    }
    async signPart(key: string, uploadId: string, partNumber: number) {
        return `https://storage.test/${key}?uploadId=${uploadId}&partNumber=${partNumber}`;
    }
    async complete(key: string, uploadId: string) {
        if (!this.uploads.delete(uploadId)) throw Object.assign(new Error('NoSuchUpload'), { name: 'NoSuchUpload' });
        this.objects.set(key, this.nextSize.get(key) ?? 0);
    }
    async abort(_key: string, uploadId: string) {
        this.uploads.delete(uploadId);
    }
    async head(key: string) {
        return this.objects.get(key) ?? null;
    }
    async signGet(key: string) {
        return `https://storage.test/${key}?signed`;
    }
    readonly texts = new Map<string, string>();
    async signStable(key: string) {
        return `https://storage.test/${key}?stable`;
    }
    async downloadTo(_key: string, path: string) {
        if (this.sourceFile) await copyFile(this.sourceFile, path);
        else await writeFile(path, 'x');
    }
    /** A real file for downloadTo to hand out (integration tests). */
    sourceFile: string | null = null;
    async putFile(key: string, path: string) {
        this.objects.set(key, (await stat(path)).size);
        if (key.endsWith('.m3u8')) this.texts.set(key, await readFile(path, 'utf8'));
    }
    async getText(key: string) {
        const text = this.texts.get(key);
        if (text === undefined) throw new Error('NoSuchKey');
        return text;
    }
    async deletePrefix(prefix: string) {
        let n = 0;
        for (const key of [...this.objects.keys()]) if (key.startsWith(prefix)) n += Number(this.objects.delete(key));
        return n;
    }
}
