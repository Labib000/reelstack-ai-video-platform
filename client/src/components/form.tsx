import type { InputHTMLAttributes, ReactNode } from 'react'

export function Field({
  label,
  error,
  ...input
}: { label: string; error?: string | undefined; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = `field-${input.name}`
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-300">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-md border bg-neutral-900 px-3 py-2 text-sm outline-none transition-colors placeholder:text-neutral-600 focus:border-red-500 ${
          error ? 'border-red-500/70' : 'border-neutral-700'
        }`}
        {...input}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Please wait…' : children}
    </button>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
      {message}
    </p>
  )
}

export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto mt-8 max-w-sm">
      <h1 className="mb-6 text-center text-2xl font-semibold">{title}</h1>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">{children}</div>
      <p className="mt-4 text-center text-sm text-neutral-400">{footer}</p>
    </div>
  )
}
