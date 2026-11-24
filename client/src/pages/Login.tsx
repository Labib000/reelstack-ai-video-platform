import { loginSchema } from '@reelstack/shared'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { apiError } from '../api/http.ts'
import { useAuth } from '../auth/context.ts'
import { AuthCard, Field, FormError, SubmitButton } from '../components/form.tsx'
import { zodFieldErrors } from '../lib/formErrors.ts'

export default function Login() {
  const { login } = useAuth()
  const [params] = useSearchParams()
  const [values, setValues] = useState({ email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const set = (field: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const parsed = loginSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error))
      return
    }
    setFieldErrors({})
    setPending(true)
    try {
      // On success RequireGuest sends us on to ?next (or home).
      await login(parsed.data)
    } catch (error) {
      const info = apiError(error)
      setFieldErrors(info.fieldErrors)
      if (Object.keys(info.fieldErrors).length === 0) setFormError(info.message)
      setPending(false)
    }
  }

  const next = params.get('next')
  return (
    <AuthCard
      title="Log in to ReelStack"
      footer={
        <>
          No account?{' '}
          <Link
            to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
            className="text-red-400 hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={formError} />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={fieldErrors.email}
          autoFocus
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={set('password')}
          error={fieldErrors.password}
        />
        <SubmitButton pending={pending}>Log in</SubmitButton>
      </form>
    </AuthCard>
  )
}
