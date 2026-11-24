import { Link, useSearchParams } from 'react-router-dom'

/** "No account? Sign up" style link that keeps the ?next= destination. */
export default function AuthFooterLink({ prompt, label, to }: { prompt: string; label: string; to: '/login' | '/register' }) {
  const [params] = useSearchParams()
  const next = params.get('next')
  return (
    <p className="text-center text-sm text-muted-foreground">
      {prompt}{' '}
      <Link to={next ? `${to}?next=${encodeURIComponent(next)}` : to} className="font-semibold text-link hover:underline">
        {label}
      </Link>
    </p>
  )
}
