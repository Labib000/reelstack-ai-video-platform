/**
 * Placeholder moderation data for the admin console's Reports page, until
 * comments and reporting exist (Phase 4).
 */

export type ReportReason = 'Spam' | 'Harassment' | 'Misinformation' | 'Copyright' | 'Inappropriate'

export interface DemoReport {
  id: string
  kind: 'video' | 'comment'
  videoId: string
  /** For comment reports: the comment text. */
  excerpt?: string
  author: string
  reason: ReportReason
  details: string
  reporters: number
  hoursAgo: number
}

export const DEMO_REPORTS: DemoReport[] = [
  { id: 'r1', kind: 'comment', videoId: 'jwt-rotation', excerpt: 'FREE crypto signals 👉 t.me/… join now!!!', author: '@quickprofit88', reason: 'Spam', details: 'Same link posted under 6 videos.', reporters: 9, hoursAgo: 1 },
  { id: 'r2', kind: 'video', videoId: 'searing-science', author: '@heatscience', reason: 'Copyright', details: 'Claims the intro music is unlicensed.', reporters: 1, hoursAgo: 5 },
  { id: 'r3', kind: 'comment', videoId: 'black-holes', excerpt: 'Anyone who believes this is an idiot. Delete your channel.', author: '@truthseeker', reason: 'Harassment', details: 'Personal attack on the creator.', reporters: 4, hoursAgo: 9 },
  { id: 'r4', kind: 'video', videoId: 'transformers', author: '@backendlab', reason: 'Misinformation', details: 'Viewer says the attention complexity at 14:20 is wrong.', reporters: 2, hoursAgo: 26 },
  { id: 'r5', kind: 'comment', videoId: 'cinema-cuts', excerpt: 'check my channel for the full movie free', author: '@moviez4all', reason: 'Spam', details: 'Links to pirated content.', reporters: 3, hoursAgo: 30 },
  { id: 'r6', kind: 'video', videoId: 'light-shadow', author: '@framebyframe', reason: 'Inappropriate', details: 'Thumbnail flagged by one viewer.', reporters: 1, hoursAgo: 52 },
]
