import type { ReactNode } from 'react'

export default function PageShell({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section>
      <h1 className="mb-4 text-2xl font-semibold">{title}</h1>
      {children ?? <p className="text-neutral-400">Coming soon.</p>}
    </section>
  )
}
