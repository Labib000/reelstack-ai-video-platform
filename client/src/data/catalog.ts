import type { ChannelDTO, VideoDetailDTO } from '@reelstack/shared'

/**
 * Placeholder catalogue for the UI shell. Phase 2+ replaces the functions in
 * ./index.ts with API calls; nothing else should import this file.
 *
 * Each chapter carries a few transcript lines. They are spread across the
 * chapter to build a transcript, and Ask / moment search match against them,
 * so the demo answers are drawn from "what the video says".
 */

const channels = {
  lab: { id: 'c-lab', name: 'Backend Lab', handle: '@backendlab', avatarUrl: null },
  frame: { id: 'c-frame', name: 'Frame by Frame', handle: '@framebyframe', avatarUrl: null },
  cosmos: { id: 'c-cosmos', name: 'Open Cosmos', handle: '@opencosmos', avatarUrl: null },
  craft: { id: 'c-craft', name: 'Quiet Craft', handle: '@quietcraft', avatarUrl: null },
  kitchen: { id: 'c-kitchen', name: 'Heat & Science', handle: '@heatscience', avatarUrl: null },
} satisfies Record<string, ChannelDTO>

export interface CatalogChapter {
  start: number
  title: string
  lines: string[]
}

export interface CatalogVideo extends Omit<VideoDetailDTO, 'chapters'> {
  chapters: CatalogChapter[]
  /** Suggested questions shown in the empty Ask panel. */
  suggestions: string[]
}

const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

const base = {
  status: 'ready',
  visibility: 'public',
  thumbnailUrl: null,
  hlsUrl: null,
} as const

export const CATALOG: CatalogVideo[] = [
  {
    ...base,
    id: 'jwt-rotation',
    title: 'Refresh-token rotation, explained properly',
    category: 'Tutorials',
    channel: channels.lab,
    durationSec: 2530,
    views: 184_200,
    likes: 9_400,
    createdAt: days(3),
    description:
      'Access tokens, refresh tokens, rotation and reuse detection, built step by step with Express and MongoDB.',
    summary:
      'Short-lived access tokens live in memory; an opaque refresh token in an httpOnly cookie is rotated on every use, and replaying an old one revokes the whole session family.',
    suggestions: ['Why keep the access token in memory?', 'What happens if a refresh token is stolen?', 'How does logout-all work?'],
    chapters: [
      { start: 0, title: 'Why sessions get stolen', lines: ['Most session theft is a token that was readable by JavaScript or lived far too long.', 'We want short-lived access tokens and a refresh token that the page can never read.'] },
      { start: 380, title: 'Access tokens in memory', lines: ['The access token stays in memory only, never in localStorage, so an injected script cannot simply read it.', 'It lives for fifteen minutes, and a page reload gets a new one from the cookie.'] },
      { start: 820, title: 'The httpOnly refresh cookie', lines: ['The refresh token is an opaque random value in an httpOnly, SameSite strict cookie scoped to the auth path.', 'Only its SHA-256 hash is stored in the database, so a leaked database does not leak working tokens.'] },
      { start: 1340, title: 'Rotation and reuse detection', lines: ['Every refresh revokes the presented token and issues a new one in the same family.', 'If an already rotated token is presented again, it was stolen or replayed, so we revoke the entire family.'] },
      { start: 1900, title: 'Logout everywhere', lines: ['Logout-all revokes every family and bumps a token version on the user.', 'Access tokens carry that version, so old ones fail at the very next request.'] },
    ],
  },
  {
    ...base,
    id: 'hls-ffmpeg',
    title: 'Building an adaptive HLS pipeline with FFmpeg',
    category: 'Tutorials',
    channel: channels.lab,
    durationSec: 3310,
    views: 96_800,
    likes: 5_100,
    createdAt: days(9),
    description: 'From one uploaded file to a 360p, 720p and 1080p ladder with a master playlist, queued with BullMQ.',
    summary: 'The worker transcodes a bitrate ladder in a single FFmpeg pass, writes segments and a master playlist to object storage, and retries failed jobs with backoff.',
    suggestions: ['What is a bitrate ladder?', 'Why use a job queue for transcoding?', 'How long should HLS segments be?'],
    chapters: [
      { start: 0, title: 'What adaptive streaming solves', lines: ['Adaptive streaming lets the player switch quality as the network changes, instead of buffering.', 'HLS splits video into short segments listed in playlists the player can choose between.'] },
      { start: 540, title: 'The bitrate ladder', lines: ['A bitrate ladder is the set of renditions, here 360p, 720p and 1080p, each with its own bitrate.', 'One FFmpeg command can decode once and encode every rung, which saves a lot of CPU.'] },
      { start: 1320, title: 'Segments and playlists', lines: ['Six second segments are a good balance between startup time and request overhead.', 'The master playlist points at one media playlist per rendition.'] },
      { start: 2150, title: 'Queues, retries and failures', lines: ['Transcoding is slow and CPU heavy, so the API only enqueues a job and returns immediately.', 'The worker retries with exponential backoff and marks the video failed after the last attempt.'] },
    ],
  },
  {
    ...base,
    id: 'vector-search',
    title: 'Vector search from scratch',
    category: 'Lectures',
    channel: channels.lab,
    durationSec: 2890,
    views: 142_000,
    likes: 8_800,
    createdAt: days(21),
    description: 'Embeddings, cosine similarity, chunking and hybrid retrieval, with no magic.',
    summary: 'Text becomes vectors; nearby vectors mean similar meaning. Good chunking and mixing keyword with vector results matter more than the model.',
    suggestions: ['What is cosine similarity?', 'How big should chunks be?', 'What is hybrid retrieval?'],
    chapters: [
      { start: 0, title: 'Text as vectors', lines: ['An embedding model turns a passage of text into a list of numbers, a vector.', 'Passages that mean similar things end up close together in that space.'] },
      { start: 620, title: 'Cosine similarity', lines: ['Cosine similarity compares the angle between two vectors and ignores their length.', 'A score near one means the passages are about the same thing.'] },
      { start: 1300, title: 'Chunking that works', lines: ['Chunks of around forty five seconds of speech, with a little overlap, keep each idea intact.', 'Chunks that are too small lose context, and chunks that are too big blur several topics together.'] },
      { start: 2050, title: 'Hybrid retrieval', lines: ['Hybrid retrieval runs a keyword search and a vector search, then merges the two lists.', 'Reciprocal rank fusion rewards passages that rank well in both lists.'] },
    ],
  },
  {
    ...base,
    id: 'black-holes',
    title: 'Black holes: what we actually know',
    category: 'Lectures',
    channel: channels.cosmos,
    durationSec: 4120,
    views: 1_240_000,
    likes: 61_000,
    createdAt: days(40),
    description: 'A public lecture on event horizons, Hawking radiation and the first black hole images.',
    summary: 'Black holes are regions where gravity traps light; we infer them from orbits and accretion, and imaged two shadows with a planet-sized telescope.',
    suggestions: ['What is an event horizon?', 'How was the first black hole photographed?', 'Do black holes evaporate?'],
    chapters: [
      { start: 0, title: 'Gravity that traps light', lines: ['A black hole is a region where gravity is so strong that not even light can escape.', 'The boundary of that region is called the event horizon.'] },
      { start: 900, title: 'Seeing the invisible', lines: ['We find black holes by watching stars orbit something massive that we cannot see.', 'Gas falling in heats up and glows brightly just before it crosses the horizon.'] },
      { start: 1980, title: 'A telescope the size of Earth', lines: ['The Event Horizon Telescope linked radio dishes across the planet into one giant instrument.', 'It imaged the shadow of the black hole in the galaxy M87 in 2019.'] },
      { start: 3050, title: 'Hawking radiation', lines: ['Hawking showed that black holes should slowly radiate and lose mass.', 'For a black hole the mass of the Sun, evaporation would take far longer than the age of the universe.'] },
    ],
  },
  {
    ...base,
    id: 'calm-interfaces',
    title: 'Designing calm interfaces',
    category: 'Talks',
    channel: channels.craft,
    durationSec: 1860,
    views: 58_300,
    likes: 4_200,
    createdAt: days(6),
    description: 'A talk about attention, motion and saying less on screen.',
    summary: 'Calm software asks for attention only when it matters: fewer colours, purposeful motion, and respect for reduced-motion settings.',
    suggestions: ['When should an interface animate?', 'How many accent colours?', 'What is reduced motion?'],
    chapters: [
      { start: 0, title: 'Attention is the budget', lines: ['Every notification and every animation spends some of the user’s attention.', 'A calm interface spends that budget only on things that matter.'] },
      { start: 520, title: 'One accent colour', lines: ['Pick one accent colour and let everything else be neutral surfaces.', 'When everything is highlighted, nothing is.'] },
      { start: 1100, title: 'Motion with a purpose', lines: ['Motion should explain a change, like where a panel came from, not decorate it.', 'Always respect the reduced motion setting in the operating system.'] },
    ],
  },
  {
    ...base,
    id: 'rust-ownership',
    title: 'Rust ownership in 40 minutes',
    category: 'Tutorials',
    channel: channels.lab,
    durationSec: 2410,
    views: 210_500,
    likes: 12_300,
    createdAt: days(14),
    description: 'Moves, borrows and lifetimes with diagrams instead of jargon.',
    summary: 'Every value has one owner; borrowing lends access without moving it, and the compiler checks that no borrow outlives its data.',
    suggestions: ['What is a move?', 'Mutable vs shared borrows?', 'What are lifetimes for?'],
    chapters: [
      { start: 0, title: 'One owner per value', lines: ['In Rust every value has exactly one owner, and the value is dropped when the owner goes out of scope.', 'Assigning a value to another variable moves it, and the old name can no longer be used.'] },
      { start: 700, title: 'Borrowing', lines: ['You can have many shared borrows or one mutable borrow, but never both at once.', 'This rule is what prevents data races at compile time.'] },
      { start: 1500, title: 'Lifetimes', lines: ['Lifetimes describe how long a borrow is valid.', 'The compiler checks that no reference outlives the data it points to.'] },
    ],
  },
  {
    ...base,
    id: 'cinema-cuts',
    title: 'A history of cinema in twelve cuts',
    category: 'Talks',
    channel: channels.frame,
    durationSec: 3620,
    views: 412_000,
    likes: 28_000,
    createdAt: days(30),
    description: 'How editing invented the language of film, from the Lumière brothers to the jump cut.',
    summary: 'Editing turned recorded moments into storytelling: continuity, montage, the match cut and the jump cut each changed what audiences could follow.',
    suggestions: ['What is a match cut?', 'Who invented montage?', 'Why was the jump cut shocking?'],
    chapters: [
      { start: 0, title: 'Before the cut', lines: ['The earliest films were single shots, a train arriving or workers leaving a factory.', 'The camera simply recorded, and the audience watched from one fixed point.'] },
      { start: 980, title: 'Montage', lines: ['Soviet filmmakers showed that two shots placed together create a meaning neither has alone.', 'That idea, montage, still drives every trailer you watch.'] },
      { start: 2100, title: 'The match cut', lines: ['A match cut links two shots by shape or motion, like a bone thrown into the air becoming a spaceship.', 'It lets a film jump across time without losing the viewer.'] },
      { start: 2900, title: 'Breaking the rules', lines: ['The French New Wave used jump cuts on purpose, breaking continuity to feel raw and modern.', 'Audiences were shocked at first, and then the style became normal.'] },
    ],
  },
  {
    ...base,
    id: 'searing-science',
    title: 'The science of a perfect sear',
    category: 'Craft',
    channel: channels.kitchen,
    durationSec: 1540,
    views: 330_700,
    likes: 19_500,
    createdAt: days(2),
    description: 'Maillard reactions, dry surfaces and why your pan is not hot enough.',
    summary: 'Browning needs a dry surface and high heat; moisture keeps the surface at boiling point and steams the food instead.',
    suggestions: ['What is the Maillard reaction?', 'Why pat meat dry?', 'Which pan is best for searing?'],
    chapters: [
      { start: 0, title: 'Browning is chemistry', lines: ['The Maillard reaction between sugars and proteins creates the flavour of a good crust.', 'It only gets going well above the boiling point of water.'] },
      { start: 480, title: 'Dry it first', lines: ['Pat the surface dry, because water keeps the surface stuck at boiling point and steams the food.', 'Salting ahead of time and resting uncovered in the fridge dries the surface even more.'] },
      { start: 960, title: 'Pans and heat', lines: ['Heavy cast iron or carbon steel holds heat, so the pan does not cool down when food goes in.', 'Do not crowd the pan, or the temperature drops and you are steaming again.'] },
    ],
  },
  {
    ...base,
    id: 'consensus',
    title: 'Distributed consensus without the headache',
    category: 'Lectures',
    channel: channels.lab,
    durationSec: 3980,
    views: 77_900,
    likes: 4_900,
    createdAt: days(50),
    description: 'Leaders, terms, logs and quorums: Raft explained with animations.',
    summary: 'Raft elects a leader per term, replicates a log to a majority, and only commits entries a quorum has stored.',
    suggestions: ['Why do we need a majority?', 'What happens when the leader dies?', 'What is a term?'],
    chapters: [
      { start: 0, title: 'Agreeing over a network', lines: ['Consensus means several machines agree on the same sequence of values even when some fail.', 'Networks drop and delay messages, which is what makes this hard.'] },
      { start: 1100, title: 'Leader election', lines: ['Raft elects one leader per term, and followers start an election when they stop hearing heartbeats.', 'A candidate needs votes from a majority to win.'] },
      { start: 2300, title: 'Replicating the log', lines: ['The leader appends entries to its log and sends them to the followers.', 'An entry is committed once a majority has stored it, so it survives any minority failing.'] },
    ],
  },
  {
    ...base,
    id: 'typography',
    title: 'Typography that people actually read',
    category: 'Craft',
    channel: channels.craft,
    durationSec: 1720,
    views: 64_100,
    likes: 5_600,
    createdAt: days(12),
    description: 'Line length, rhythm and contrast for interfaces and long-form text.',
    summary: 'Readable text comes from line length around sixty characters, generous line height and enough contrast, before any choice of typeface.',
    suggestions: ['What is a good line length?', 'How much line height?', 'Serif or sans?'],
    chapters: [
      { start: 0, title: 'Measure', lines: ['Keep lines around sixty to seventy five characters, so the eye can find the next line.', 'Very long lines are tiring, very short ones break the rhythm of reading.'] },
      { start: 600, title: 'Rhythm', lines: ['Body text needs a line height of roughly one and a half times the font size.', 'Consistent spacing between paragraphs makes a page feel calm.'] },
      { start: 1150, title: 'Contrast', lines: ['Text needs a contrast ratio of at least four and a half to one against its background.', 'Light grey text on white looks elegant and is hard to read.'] },
    ],
  },
  {
    ...base,
    id: 'transformers',
    title: 'How transformers pay attention',
    category: 'Lectures',
    channel: channels.cosmos,
    durationSec: 3240,
    views: 520_400,
    likes: 33_100,
    createdAt: days(18),
    description: 'Queries, keys, values and why attention changed language models.',
    summary: 'Attention lets every token weigh every other token; stacking attention layers builds context, and training predicts the next token.',
    suggestions: ['What are queries, keys and values?', 'Why is attention parallel?', 'What does a transformer predict?'],
    chapters: [
      { start: 0, title: 'From words to tokens', lines: ['Text is split into tokens, and each token becomes a vector.', 'The model predicts the next token, over and over.'] },
      { start: 820, title: 'Queries, keys and values', lines: ['Each token makes a query, a key and a value.', 'Attention scores compare a query with every key, then mix the values by those scores.'] },
      { start: 1900, title: 'Why it scaled', lines: ['Unlike older recurrent models, attention looks at every token at once, so it runs in parallel on GPUs.', 'That is what made training on huge amounts of text practical.'] },
    ],
  },
  {
    ...base,
    id: 'light-shadow',
    title: 'Photography: learning to see light',
    category: 'Craft',
    channel: channels.frame,
    durationSec: 2050,
    views: 148_900,
    likes: 10_700,
    createdAt: days(25),
    description: 'Hard light, soft light, golden hour and reading shadows.',
    summary: 'The size of a light source relative to the subject decides whether shadows are hard or soft; direction decides the mood.',
    suggestions: ['What makes light soft?', 'Why is golden hour flattering?', 'Where should the light come from?'],
    chapters: [
      { start: 0, title: 'Hard and soft light', lines: ['A small light source makes hard shadows, a large one makes soft shadows.', 'An overcast sky is one enormous soft box.'] },
      { start: 700, title: 'Golden hour', lines: ['Near sunrise and sunset the light is low, warm and soft.', 'Low light from the side shows texture and shape.'] },
      { start: 1350, title: 'Direction and mood', lines: ['Light from the front flattens a face, light from the side gives it depth.', 'Backlight separates the subject from the background with a rim of light.'] },
    ],
  },
  {
    ...base,
    id: 'kubernetes',
    title: 'Kubernetes without tears',
    category: 'Tutorials',
    channel: channels.lab,
    durationSec: 3460,
    views: 88_400,
    likes: 5_900,
    createdAt: days(60),
    description: 'Pods, deployments, services and the mental model that makes it click.',
    summary: 'You declare the state you want; controllers keep reconciling reality towards it. Pods run containers, services give them stable addresses.',
    suggestions: ['What is a pod?', 'What does a deployment do?', 'How do services find pods?'],
    chapters: [
      { start: 0, title: 'Desired state', lines: ['In Kubernetes you declare the state you want, not the steps to get there.', 'Controllers keep comparing reality with that state and fixing the difference.'] },
      { start: 980, title: 'Pods and deployments', lines: ['A pod is one or more containers that are scheduled together.', 'A deployment keeps the right number of pods running and rolls out new versions.'] },
      { start: 2100, title: 'Services', lines: ['Pods come and go, so a service gives them one stable address.', 'Services find their pods through labels.'] },
    ],
  },
  {
    ...base,
    id: 'startup-finance',
    title: 'Startup finance for engineers',
    category: 'Talks',
    channel: channels.craft,
    durationSec: 2280,
    views: 41_600,
    likes: 2_900,
    createdAt: days(8),
    description: 'Runway, burn, dilution and how to read an offer letter.',
    summary: 'Runway is cash divided by monthly burn; equity is worth its share of a future outcome, after dilution and preferences.',
    suggestions: ['How do you calculate runway?', 'What is dilution?', 'How should I value equity?'],
    chapters: [
      { start: 0, title: 'Runway and burn', lines: ['Burn is how much money the company loses each month.', 'Runway is cash in the bank divided by burn, the months left before it runs out.'] },
      { start: 760, title: 'Dilution', lines: ['Every funding round issues new shares, so your percentage shrinks.', 'A smaller slice of a bigger company can still be worth more.'] },
      { start: 1500, title: 'Reading an offer', lines: ['Ask for the number of shares, the total shares outstanding and the strike price.', 'Without the total, a number of options tells you nothing.'] },
    ],
  },
]

/** Mock watch progress (0–1) for the "Continue watching" shelf. */
export const CONTINUE_WATCHING: Record<string, number> = {
  'hls-ffmpeg': 0.42,
  transformers: 0.18,
  'searing-science': 0.76,
  'rust-ownership': 0.55,
}

