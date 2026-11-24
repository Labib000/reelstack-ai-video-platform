import type { LucideIcon } from 'lucide-react'

export default function AuthHeader({ title, subtitle, icon: Icon }: { title: string; subtitle: string; icon?: LucideIcon }) {
  return (
    <div className="space-y-3">
      {Icon && (
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-brand ring-1 ring-primary/20">
          <Icon className="size-5" />
        </span>
      )}
      <div className="space-y-1.5">
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}
