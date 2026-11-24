import { hashString } from '@/lib/format'

/** Cinematic gradient palettes: [deep, mid, highlight]. */
const PALETTES: [string, string, string][] = [
  ['#450a0a', '#dc2626', '#fb923c'], // ember
  ['#1e1b4b', '#4338ca', '#22d3ee'], // indigo night
  ['#052e16', '#15803d', '#facc15'], // forest
  ['#3b0764', '#a21caf', '#fb7185'], // plum
  ['#0c4a6e', '#0284c7', '#f0abfc'], // ocean
  ['#431407', '#c2410c', '#fde68a'], // amber
  ['#0f172a', '#334155', '#f87171'], // slate & red
  ['#500724', '#db2777', '#fdba74'], // sunset
]

export function posterPalette(seed: string) {
  const h = hashString(seed)
  const [deep, mid, light] = PALETTES[h % PALETTES.length]!
  return { deep, mid, light, angle: 110 + (h % 70), glowX: 20 + ((h >> 3) % 60), glowY: 15 + ((h >> 7) % 50) }
}

/** CSS background for a seed: also used for ambient glows behind the stage. */
export function posterBackground(seed: string): string {
  const p = posterPalette(seed)
  return `radial-gradient(circle at ${p.glowX}% ${p.glowY}%, ${p.light}cc 0%, transparent 45%), linear-gradient(${p.angle}deg, ${p.deep} 0%, ${p.mid} 65%, ${p.light} 140%)`
}
