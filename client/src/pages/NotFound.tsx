import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

/** The logo's screen, showing static: no signal on this channel. */
export default function NotFound() {
  return (
    <section className="flex flex-col items-center py-16 text-center">
      <div className="relative aspect-[335/291] w-56 sm:w-72">
        <svg viewBox="0 0 335 291" className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <clipPath id="nf-screen">
              <path d="M70 49 L287 79 Q299 81 299 93 L299 203 Q299 215 287 217 L70 242 Q55 244 55 229 L55 63 Q55 47 70 49 Z" />
            </clipPath>
          </defs>
          <path fill="var(--brand)" d="M55 1 L296 46 Q334 53 334 92 L334 200 Q334 238 296 245 L55 289 Q1 299 1 240 L1 52 Q1 -8 55 1 Z" />
          <path fill="#121111" d="M70 49 L287 79 Q299 81 299 93 L299 203 Q299 215 287 217 L70 242 Q55 244 55 229 L55 63 Q55 47 70 49 Z" />
          <foreignObject x="0" y="0" width="335" height="291" clipPath="url(#nf-screen)">
            <div className="static-noise size-full opacity-60" />
          </foreignObject>
          <text x="177" y="160" textAnchor="middle" className="fill-white font-display text-[64px] font-bold">
            404
          </text>
        </svg>
      </div>
      <h1 className="mt-8 font-display text-2xl font-bold">No signal on this channel</h1>
      <p className="mt-2 text-muted-foreground">This page doesn't exist or was moved.</p>
      <Button asChild className="mt-6 rounded-full">
        <Link to="/">Back to the stage</Link>
      </Button>
    </section>
  )
}
