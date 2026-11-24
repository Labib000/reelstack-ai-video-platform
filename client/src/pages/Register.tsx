import { registerSchema } from '@reelstack/shared'
import { type ChangeEvent, type FormEvent, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { apiError } from '../api/http.ts'
import { useAuth } from '../auth/context.ts'
import { AuthCard, Field, FormError, SubmitButton } from '../components/form.tsx'
import { zodFieldErrors } from '../lib/formErrors.ts'

export default function Register() {
  const { register } = useAuth()
  const [params] = useSearchParams()
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const set = (field: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const parsed = registerSchema.safeParse(values)
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error))
      return
    }
    setFieldErrors({})
    setPending(true)
    try {
      await register(parsed.data)
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
      title="Create your account"
      footer={
        <>
          Already have an account?{' '}
          <Link
            to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
            className="text-red-400 hover:underline"
          >
            Log in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-4">
        <FormError message={formError} />
        <Field
          label="Name"
          name="name"
          autoComplete="name"
          value={values.name}
          onChange={set('name')}
          error={fieldErrors.name}
          autoFocus
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={fieldErrors.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={fieldErrors.password}
        />
        <p className="-mt-2 text-xs text-neutral-500">At least 8 characters.</p>
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
    </AuthCard>
  )
}
