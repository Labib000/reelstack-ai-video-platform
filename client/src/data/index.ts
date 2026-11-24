import type {
  AskAnswer,
  ChannelDTO,
  MomentDTO,
  TranscriptSegment,
  VideoDetailDTO,
  VideoSummaryDTO,
} from '@reelstack/shared'

import { CATALOG, type CatalogVideo } from './catalog'

/**
 * The client's data layer. These return placeholder data today; in Phase 2+
 * each body becomes an `api.get(...)` call returning the same shared types,
 * and no component has to change.
 */

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

function toSummary(v: CatalogVideo): VideoSummaryDTO {
  const { id, title, durationSec, views, createdAt, category, status, visibility, thumbnailUrl, channel, summary } = v
  return { id, title, durationSec, views, createdAt, category, status, visibility, thumbnailUrl, channel, summary }
}

function toDetail(v: CatalogVideo): VideoDetailDTO {
  return { ...v, chapters: v.chapters.map(({ start, title }) => ({ start, title })) }
}

/** Chapter lines spread evenly across each chapter. */
function transcriptOf(v: CatalogVideo): TranscriptSegment[] {
  return v.chapters.flatMap((chapter, i) => {
    const end = v.chapters[i + 1]?.start ?? v.durationSec
    const step = (end - chapter.start) / chapter.lines.length
    return chapter.lines.map((text, j) => ({
      start: Math.round(chapter.start + j * step),
      end: Math.round(chapter.start + (j + 1) * step),
      text,
    }))
  })
}

const STOP = new Set(
  'what when where which who whom whose why how does do did is are was were the a an of to in on for and or but with that this those these be it its can could should would will about from into than then there their them they you your i me my we our at by as if so not no yes'.split(
    ' ',
  ),
)

const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))

/** Crude relevance: shared words, with prefix matches ("rotate" ~ "rotation"). */
function score(query: string[], text: string): number {
  const ws = words(text)
  return query.reduce(
    (sum, q) => sum + (ws.some((w) => w === q) ? 2 : ws.some((w) => w.startsWith(q.slice(0, 5)) && q.length > 4) ? 1 : 0),
    0,
  )
}

const find = (id: string) => CATALOG.find((v) => v.id === id)

export async function listVideos(category?: string): Promise<VideoSummaryDTO[]> {
  await delay()
  return CATALOG.filter((v) => !category || v.category === category).map(toSummary)
}

export const CATEGORIES = ['Tutorials', 'Lectures', 'Talks', 'Craft'] as const

export async function getVideo(id: string): Promise<VideoDetailDTO | null> {
  await delay(200)
  const v = find(id)
  return v ? toDetail(v) : null
}

export async function getSuggestions(id: string): Promise<string[]> {
  return find(id)?.suggestions ?? []
}

export async function getTranscript(id: string): Promise<TranscriptSegment[]> {
  await delay(200)
  const v = find(id)
  return v ? transcriptOf(v) : []
}

export const FEATURED_IDS = ['jwt-rotation', 'black-holes', 'cinema-cuts']

export async function getFeatured(): Promise<VideoDetailDTO[]> {
  await delay()
  return FEATURED_IDS.map((id) => toDetail(find(id)!))
}

export interface Shelf {
  id: string
  title: string
  kind?: 'top10'
  items: VideoSummaryDTO[]
}

/** Public home shelves, optionally narrowed to one category. */
export async function listShelves(category?: string): Promise<Shelf[]> {
  await delay()
  const pool = CATALOG.filter((v) => !category || v.category === category)
  const byViews = [...pool].sort((a, b) => b.views - a.views)
  const shelves: Shelf[] = [
    { id: 'top10', title: 'Top 10 this week', kind: 'top10', items: byViews.slice(0, 10).map(toSummary) },
    { id: 'new', title: 'Fresh this week', items: [...pool].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8).map(toSummary) },
  ]
  if (!category) {
    shelves.push(
      { id: 'tutorials', title: 'Hands-on tutorials', items: CATALOG.filter((v) => v.category === 'Tutorials').map(toSummary) },
      { id: 'lectures', title: 'Lectures worth your evening', items: CATALOG.filter((v) => v.category === 'Lectures').map(toSummary) },
      { id: 'talks', title: 'Talks & craft', items: CATALOG.filter((v) => v.category === 'Talks' || v.category === 'Craft').map(toSummary) },
    )
  }
  return shelves.filter((s) => s.items.length > 0)
}

/** One memorable line from each video, for the "Heard this week" shelf. */
export async function listHeardThisWeek(category?: string): Promise<MomentDTO[]> {
  await delay()
  return CATALOG.filter((v) => !category || v.category === category).slice(0, 8).map((v) => {
    const seg = transcriptOf(v)[2] ?? transcriptOf(v)[0]!
    return { video: toSummary(v), start: seg.start, snippet: seg.text }
  })
}

/** Summaries in the order of `ids`, skipping unknown ones (History, Saved, Liked). */
export async function getVideosByIds(ids: string[]): Promise<VideoSummaryDTO[]> {
  await delay(150)
  return ids.flatMap((id) => {
    const v = find(id)
    return v ? [toSummary(v)] : []
  })
}

export async function listChannels(): Promise<ChannelDTO[]> {
  return [...new Map(CATALOG.map((v) => [v.channel.id, v.channel])).values()]
}

/** Newest videos from the given channels. */
export async function getSubscriptionFeed(channelIds: string[]): Promise<VideoSummaryDTO[]> {
  await delay()
  return CATALOG.filter((v) => channelIds.includes(v.channel.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toSummary)
}

export async function getUpNext(id: string): Promise<VideoSummaryDTO[]> {
  await delay()
  const current = find(id)
  return CATALOG.filter((v) => v.id !== id)
    .sort((a, b) => Number(b.category === current?.category) - Number(a.category === current?.category))
    .slice(0, 8)
    .map(toSummary)
}

export async function getChannel(id: string): Promise<{ channel: ChannelDTO; videos: VideoSummaryDTO[] } | null> {
  await delay()
  const videos = CATALOG.filter((v) => v.channel.id === id)
  return videos[0] ? { channel: videos[0].channel, videos: videos.map(toSummary) } : null
}

/** Moments across the library whose transcript matches the query. */
export async function searchMoments(query: string, limit = 6): Promise<MomentDTO[]> {
  await delay(150)
  const q = words(query)
  if (q.length === 0) return []
  return CATALOG.flatMap((v) =>
    transcriptOf(v).map((seg) => ({ video: toSummary(v), start: seg.start, snippet: seg.text, s: score(q, seg.text) })),
  )
    .filter((m) => m.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(({ video, start, snippet }) => ({ video, start, snippet }))
}

export async function searchVideos(query: string): Promise<VideoSummaryDTO[]> {
  await delay(150)
  const q = words(query)
  if (q.length === 0) return []
  return CATALOG.map((v) => ({ v, s: score(q, `${v.title} ${v.description} ${v.category}`) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .map(({ v }) => toSummary(v))
}

/**
 * Canned "Ask the Video": answers from the best-matching transcript lines,
 * with citations, or says the video doesn't cover it. Phase 5 swaps in RAG.
 */
export async function askVideo(id: string, question: string): Promise<AskAnswer> {
  await delay(900)
  const v = find(id)
  const q = words(question)
  const hits = (v ? transcriptOf(v) : [])
    .map((seg) => ({ seg, s: score(q, seg.text) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 2)
    .sort((a, b) => a.seg.start - b.seg.start)

  if (hits.length === 0) {
    return {
      covered: false,
      answer: "That isn't covered in this video. Try asking about one of the chapters.",
      citations: [],
    }
  }
  return {
    covered: true,
    answer: hits.map(({ seg }) => seg.text).join(' '),
    citations: hits.map(({ seg }) => ({ start: seg.start, quote: seg.text })),
  }
}
