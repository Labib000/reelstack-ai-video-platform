import { useId, useState } from 'react'

const dayLabel = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** A small dependency-free area chart of signups per day, with a hover readout. */
export default function SignupChart({ data }: { data: { date: string; count: number }[] }) {
  const id = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const W = 600
  const H = 180
  const P = { top: 12, bottom: 24 }
  const max = Math.max(1, ...data.map((d) => d.count))
  const step = data.length > 1 ? W / (data.length - 1) : W
  const y = (v: number) => P.top + (1 - v / max) * (H - P.top - P.bottom)
  const points = data.map((d, i) => [i * step, y(d.count)] as const)
  const line = points.map(([x, py], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H - P.bottom} L0,${H - P.bottom} Z`
  const active = hover !== null ? data[hover] : null
  const total = data.reduce((n, d) => n + d.count, 0)

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <p className="text-muted-foreground">
          {active ? (
            <>
              <span className="font-semibold text-foreground tabular-nums">{active.count}</span> on {dayLabel.format(new Date(active.date))}
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground tabular-nums">{total}</span> in the last 30 days
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground">peak {max}/day</p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-44 w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Signups per day for the last 30 days, ${total} in total`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(((e.clientX - box.left) / box.width) * (data.length - 1)))))
        }}
      >
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((t) => (
          <line key={t} x1="0" x2={W} y1={y(max * t)} y2={y(max * t)} stroke="currentColor" className="text-border" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill={`url(#fill-${id})`} />
        <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover !== null && points[hover] && (
          <>
            <line x1={points[hover][0]} x2={points[hover][0]} y1={P.top} y2={H - P.bottom} stroke="currentColor" className="text-muted-foreground/50" vectorEffect="non-scaling-stroke" />
            <circle cx={points[hover][0]} cy={points[hover][1]} r="4" fill="var(--brand)" stroke="var(--background)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{data[0] && dayLabel.format(new Date(data[0].date))}</span>
        <span>Today</span>
      </div>
    </div>
  )
}
