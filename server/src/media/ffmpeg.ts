/** Running FFmpeg: argument building (pure) and the processes themselves. */
import { spawn } from 'node:child_process';

import { CONTAINER_WHITELIST } from './probe.js';
import type { Rendition } from './ladder.js';

/** Untrusted input: local file only, plain containers only (no playlists). */
const input = (path: string) => ['-protocol_whitelist', 'file', '-format_whitelist', CONTAINER_WHITELIST, '-i', path];

/** One pass, every quality, keyframes aligned so players can switch cleanly. */
export function hlsArgs(source: string, outDir: string, renditions: Rendition[], hasAudio: boolean): string[] {
    const split = `[0:V:0]split=${renditions.length}${renditions.map((_, i) => `[s${i}]`).join('')}`;
    const scales = renditions.map((r, i) => `[s${i}]scale=${r.scale},format=yuv420p[v${i}]`);
    return [
        '-hide_banner', '-nostdin', '-y', '-v', 'error', '-progress', 'pipe:1',
        ...input(source),
        '-filter_complex', [split, ...scales].join(';'),
        ...renditions.flatMap((_, i) => ['-map', `[v${i}]`, ...(hasAudio ? ['-map', '0:a:0'] : [])]),
        '-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-fpsmax', '60',
        '-force_key_frames', 'expr:gte(t,n_forced*6)', '-sc_threshold', '0',
        ...renditions.flatMap((r, i) => [
            `-b:v:${i}`, `${r.videoKbps}k`, `-maxrate:v:${i}`, `${Math.round(r.videoKbps * 1.1)}k`, `-bufsize:v:${i}`, `${r.videoKbps * 2}k`,
            ...(hasAudio ? [`-b:a:${i}`, `${r.audioKbps}k`] : []),
        ]),
        ...(hasAudio ? ['-c:a', 'aac', '-ac', '2', '-ar', '48000'] : []),
        // One file per quality, addressed by byte range: one signed URL protects it all.
        '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod', '-hls_segment_type', 'fmp4', '-hls_flags', 'single_file',
        '-var_stream_map', renditions.map((r, i) => (hasAudio ? `v:${i},a:${i},name:${r.name}` : `v:${i},name:${r.name}`)).join(' '),
        '-master_pl_name', 'master.m3u8',
        `${outDir}/%v.m3u8`,
    ];
}

export function thumbnailArgs(source: string, out: string, atSec: number): string[] {
    return [
        '-hide_banner', '-nostdin', '-y', '-v', 'error',
        '-ss', atSec.toFixed(2), ...input(source),
        '-map', '0:V:0', '-frames:v', '1', '-update', '1', '-vf', "scale='min(1280,iw)':-2", '-q:v', '4', out,
    ];
}

export interface RunOptions {
    signal?: AbortSignal;
    /** Seconds of output written so far. */
    onProgress?: (sec: number) => void;
    /** Kill it when output hasn't advanced for this long. */
    stallMs?: number;
}

export type RunFfmpeg = (args: string[], opts?: RunOptions) => Promise<void>;

export const runFfmpeg: RunFfmpeg = (args, { signal, onProgress, stallMs = 5 * 60_000 } = {}) =>
    new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason as Error);
        const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stderr = '';
        let buffer = '';
        let lastSec = -1;
        let failure: Error | null = null;
        const kill = (error: Error) => {
            failure ??= error;
            child.kill('SIGKILL');
        };
        const stalled = () => kill(new Error('FFmpeg stopped making progress'));
        let timer = setTimeout(stalled, stallMs);
        const onAbort = () => kill(signal!.reason as Error);
        signal?.addEventListener('abort', onAbort, { once: true });

        child.stderr.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-2000)));
        child.stdout.on('data', (d: Buffer) => {
            buffer += d.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop()!;
            for (const line of lines) {
                const us = Number(/^out_time_us=(\d+)/.exec(line)?.[1] ?? NaN);
                if (Number.isNaN(us) || us / 1e6 <= lastSec) continue;
                lastSec = us / 1e6;
                clearTimeout(timer);
                timer = setTimeout(stalled, stallMs);
                onProgress?.(lastSec);
            }
        });
        const done = (error: Error | null) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            if (error) reject(error);
            else resolve();
        };
        child.on('error', done);
        child.on('close', (code) => done(failure ?? (code === 0 ? null : new Error(`FFmpeg exited with ${code}: ${stderr.trim()}`))));
    });
