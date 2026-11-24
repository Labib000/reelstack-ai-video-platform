import { useId } from 'react'

import { cn } from '@/lib/utils'

/**
 * The full ReelStack wordmark. Both versions are in the DOM and CSS shows the
 * one for the current theme, so switching themes never flashes the wrong one.
 * "Reel" is white on dark and ink on light; "Stack" and the mark stay red.
 */
export function Logo({ className }: { className?: string }) {
  const img = 'h-full w-auto select-none'
  return (
    <span className={cn('inline-flex h-7 items-center', className)}>
      <picture className="hidden h-full dark:block">
        <source type="image/webp" srcSet="/brand/wordmark-dark.webp 2x, /brand/wordmark-dark@3x.webp 3x" />
        <img src="/brand/wordmark-dark.png" alt="ReelStack" className={img} draggable={false} />
      </picture>
      <picture className="block h-full dark:hidden">
        <source type="image/webp" srcSet="/brand/wordmark-light.webp 2x, /brand/wordmark-light@3x.webp 3x" />
        <img src="/brand/wordmark-light.png" alt="ReelStack" className={img} draggable={false} />
      </picture>
    </span>
  )
}

/** The play-screen mark alone, as inline SVG (same paths as /favicon.svg). */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  // Unique per instance: a gradient inside a hidden (display:none) copy
  // of the mark would otherwise break every other copy's fill.
  const gradient = `rs-mark-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`
  return (
    <svg
      viewBox="0 0 335 291"
      className={cn('h-7 w-auto', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8232b" />
          <stop offset="1" stopColor="#e01626" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradient})`}
        d="M55 1 L296 46 Q334 53 334 92 L334 200 Q334 238 296 245 L55 289 Q1 299 1 240 L1 52 Q1 -8 55 1 Z"
      />
      <path fill="#121111" d="M70 49 L287 79 Q299 81 299 93 L299 203 Q299 215 287 217 L70 242 Q55 244 55 229 L55 63 Q55 47 70 49 Z" />
      <path fill="#fbfbfb" d="M143 106 Q143 91 156 98 L218 138 Q229 146 218 154 L156 196 Q143 203 143 188 Z" />
    </svg>
  )
}
