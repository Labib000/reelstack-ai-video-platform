import { registerSchema, usernameSchema } from '@reelstack/shared'
import { z } from 'zod'

/**
 * The signup form: the API's registerSchema plus a confirm-password field.
 * acceptTerms is a plain boolean here (the form starts unticked) and must be
 * true to pass, like the API's literal.
 */
export const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.boolean().refine((v) => v, 'You need to accept the Terms of Service and Privacy Policy'),
    marketingOptIn: z.boolean(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: "Passwords don't match",
    // Check even while other steps' fields are still empty.
    when: (payload) => {
      const v = payload.value as { password?: unknown; confirmPassword?: unknown }
      return typeof v.password === 'string' && typeof v.confirmPassword === 'string' && v.confirmPassword !== ''
    },
  })

export type RegisterFormValues = z.infer<typeof registerFormSchema>

export const REGISTER_STEPS = [
  { id: 'account', title: 'Account', description: 'Your email and a password', fields: ['email', 'password', 'confirmPassword'] },
  { id: 'profile', title: 'Profile', description: 'How you appear on ReelStack', fields: ['name', 'username', 'dateOfBirth'] },
  { id: 'interests', title: 'Interests', description: 'Tune your home page', fields: ['interests', 'acceptTerms', 'marketingOptIn'] },
] as const satisfies readonly { id: string; title: string; description: string; fields: readonly (keyof RegisterFormValues)[] }[]

export const REGISTER_FIELDS = REGISTER_STEPS.flatMap((s) => s.fields)

/** Which step owns a field, so a server error can send the user back there. */
export function stepOfField(field: string): number {
  return Math.max(0, REGISTER_STEPS.findIndex((s) => (s.fields as readonly string[]).includes(field)))
}

/** Latest allowed birth date (13 today), as YYYY-MM-DD for the date input's max. */
export function latestBirthDate(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear() - 13, now.getUTCMonth(), now.getUTCDate()))
  return d.toISOString().slice(0, 10)
}

/** A few valid @handle ideas from a display name. */
export function suggestUsernames(name: string): string[] {
  const words = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return []
  const [first, ...rest] = words as [string, ...string[]]
  const last = rest.at(-1)
  const ideas = last ? [`${first}.${last}`, `${first}${last}`, `${first}_${last[0]}`, `${first[0]}${last}`] : [first, `${first}_watches`, `${first}.tv`]
  return [...new Set(ideas.map((u) => (/^[a-z]/.test(u) ? u : `u${u}`).slice(0, 30)))]
    .filter((u) => usernameSchema.safeParse(u).success)
    .slice(0, 3)
}
