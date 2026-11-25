/** Which qualities to make from a source, and how to scale to each. */
export interface Rendition {
    /** Label and file name: the short side in pixels (720 = "720p", portrait too). */
    name: number;
    scale: string;
    videoKbps: number;
    audioKbps: number;
}

const LADDER = [
    { name: 360, videoKbps: 800, audioKbps: 96 },
    { name: 720, videoKbps: 2800, audioKbps: 128 },
    { name: 1080, videoKbps: 5000, audioKbps: 160 },
];

/** Never upscales. H.264 needs even dimensions, hence -2 and the trunc. */
export function ladderFor(width: number, height: number): Rendition[] {
    const short = Math.min(width, height);
    const fits = LADDER.filter((r) => r.name <= short);
    if (fits.length === 0) {
        return [{ name: Math.max(2, short - (short % 2)), scale: 'trunc(iw/2)*2:trunc(ih/2)*2', videoKbps: 500, audioKbps: 96 }];
    }
    return fits.map((r) => ({ ...r, scale: width >= height ? `-2:${r.name}` : `${r.name}:-2` }));
}

/** Rough upper bound on output size, for the disk check. */
export function estimateBytes(renditions: Rendition[], durationSec: number): number {
    const kbps = renditions.reduce((n, r) => n + r.videoKbps * 1.1 + r.audioKbps, 0);
    return Math.ceil(((kbps * 1000) / 8) * durationSec);
}
