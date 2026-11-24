/**
 * Scrolls `child` into view inside `container` only. Element.scrollIntoView
 * also scrolls every ancestor, including the window, which made the page
 * jump when the transcript followed playback.
 */
export function scrollWithin(container: HTMLElement | null, child: HTMLElement | null, align: 'center' | 'end' = 'center') {
  if (!container || !child) return
  const c = container.getBoundingClientRect()
  const r = child.getBoundingClientRect()
  const offset = r.top - c.top + container.scrollTop
  const top = align === 'center' ? offset - container.clientHeight / 2 + r.height / 2 : offset + r.height - container.clientHeight
  container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}
