import { zodResolver } from '@hookform/resolvers/zod'
import { type UsernameAvailability, usernameSchema } from '@reelstack/shared'
import { AlertCircleIcon, ArrowLeftIcon, ArrowRightIcon, AtSignIcon, CheckCircle2Icon, UserPlusIcon, XCircleIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { apiError } from '@/api/http'
import { checkUsername } from '@/api/users'
import { useAuth } from '@/auth/context'
import { REGISTER_FIELDS, REGISTER_STEPS, type RegisterFormValues, latestBirthDate, registerFormSchema, stepOfField, suggestUsernames } from '@/auth/register-form'
import AuthFooterLink from '@/components/auth/AuthFooterLink'
import AuthHeader from '@/components/auth/AuthHeader'
import AuthPanel from '@/components/auth/AuthPanel'
import InterestPicker from '@/components/auth/InterestPicker'
import PasswordStrength from '@/components/auth/PasswordStrength'
import Stepper from '@/components/auth/Stepper'
import PasswordInput from '@/components/password-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { applyServerErrors } from '@/lib/serverErrors'
import { cn } from '@/lib/utils'

type UsernameStatus = { state: 'idle' } | { state: 'checking' } | { state: 'available' } | { state: 'unavailable'; reason: string }

/** Live @handle availability: local format check first, then the API (debounced). */
function useUsernameStatus(username: string): UsernameStatus {
  const value = username.trim().toLowerCase()
  const debounced = useDebouncedValue(value, 300)
  const [result, setResult] = useState<{ username: string; availability: UsernameAvailability } | null>(null)
  const local = usernameSchema.safeParse(value)

  useEffect(() => {
    if (!debounced || !usernameSchema.safeParse(debounced).success) return
    const controller = new AbortController()
    checkUsername(debounced, controller.signal)
      .then((availability) => setResult({ username: debounced, availability }))
      .catch(() => {
        // Offline or rate-limited: the server re-checks on submit anyway.
        if (!controller.signal.aborted) setResult({ username: debounced, availability: { available: true } })
      })
    return () => controller.abort()
  }, [debounced])

  if (!value) return { state: 'idle' }
  if (!local.success) return { state: 'unavailable', reason: local.error.issues[0]?.message ?? 'Invalid username' }
  if (result?.username !== value) return { state: 'checking' }
  return result.availability.available ? { state: 'available' } : { state: 'unavailable', reason: result.availability.reason ?? 'Unavailable' }
}

const LAST = REGISTER_STEPS.length - 1

export default function Register() {
  const { register } = useAuth()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    mode: 'onTouched',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      name: '',
      username: '',
      dateOfBirth: '',
      interests: [],
      acceptTerms: false,
      marketingOptIn: false,
    },
  })
  const { isSubmitting, errors } = form.formState
  const [password, name, username] = useWatch({ control: form.control, name: ['password', 'name', 'username'] })
  const usernameStatus = useUsernameStatus(username)
  const suggestions = suggestUsernames(name).filter((s) => s !== username.trim().toLowerCase())

  // Focus the first field of each new step (not on first load).
  useEffect(() => {
    if (step === 0 && !form.formState.isSubmitted && !form.getFieldState('email').isTouched) return
    const first = REGISTER_STEPS[step]?.fields[0]
    if (first && first !== 'interests') form.setFocus(first)
  }, [step, form])

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const fields = REGISTER_STEPS[step]!.fields
    if (!(await form.trigger(fields, { shouldFocus: true }))) return

    if (step === 1) {
      if (usernameStatus.state === 'checking') return
      if (usernameStatus.state === 'unavailable') {
        form.setError('username', { type: 'server', message: usernameStatus.reason }, { shouldFocus: true })
        return
      }
    }
    if (step < LAST) {
      goTo(step + 1)
      return
    }

    const values = form.getValues()
    try {
      const { confirmPassword: _confirm, ...rest } = values
      await register({ ...rest, acceptTerms: true })
      // RequireGuest moves us on once the session exists.
    } catch (error) {
      applyServerErrors(error, form.setError, REGISTER_FIELDS)
      const fieldWithError = Object.keys(apiError(error).fieldErrors)[0]
      if (fieldWithError) {
        const target = stepOfField(fieldWithError)
        if (target !== step) {
          goTo(target)
          toast.error('Please check the highlighted field.')
        }
      }
    }
  }

  const current = REGISTER_STEPS[step]!

  return (
    <AuthPanel>
      <AuthHeader icon={UserPlusIcon} title="Create your account" subtitle="Three quick steps. Then ask any video anything." />
      <Stepper steps={REGISTER_STEPS} current={step} onSelect={goTo} />

      <Form {...form}>
        <form noValidate onSubmit={onSubmit} className="space-y-6">
          {errors.root && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}

          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.fieldset
                key={current.id}
                custom={direction}
                initial={{ opacity: 0, x: direction * 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction * -32 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="grid gap-5"
              >
                <legend className="sr-only">
                  {current.title}: {current.description}
                </legend>

                {step === 0 && (
                  <>
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="email" placeholder="you@example.com" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <PasswordInput autoComplete="new-password" className="h-11" {...field} />
                          </FormControl>
                          <PasswordStrength password={password} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm password</FormLabel>
                          <FormControl>
                            <PasswordInput autoComplete="new-password" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {step === 1 && (
                  <>
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full name</FormLabel>
                          <FormControl>
                            <Input autoComplete="name" placeholder="Ada Lovelace" className="h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <div className="relative">
                            <AtSignIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <FormControl>
                              <Input
                                autoComplete="off"
                                autoCapitalize="none"
                                spellCheck={false}
                                placeholder="ada.lovelace"
                                className="h-11 pr-10 pl-9"
                                {...field}
                                onChange={(e) => field.onChange(e.target.value.toLowerCase().replace(/\s/g, ''))}
                              />
                            </FormControl>
                            <span className="absolute top-1/2 right-3 -translate-y-1/2">
                              {usernameStatus.state === 'checking' && <Spinner className="size-4 text-muted-foreground" />}
                              {usernameStatus.state === 'available' && <CheckCircle2Icon className="size-4 text-green-600 dark:text-green-400" aria-label="Available" />}
                              {usernameStatus.state === 'unavailable' && <XCircleIcon className="size-4 text-destructive-foreground" aria-label="Unavailable" />}
                            </span>
                          </div>
                          {!errors.username && (
                            <FormDescription className={cn(usernameStatus.state === 'unavailable' && 'text-destructive-foreground', usernameStatus.state === 'available' && 'text-green-600 dark:text-green-400')}>
                              {usernameStatus.state === 'available'
                                ? `@${username.trim().toLowerCase()} is available`
                                : usernameStatus.state === 'unavailable'
                                  ? usernameStatus.reason
                                  : 'Your public handle. Lowercase letters, numbers, _ and .'}
                            </FormDescription>
                          )}
                          <FormMessage />
                          {suggestions.length > 0 && usernameStatus.state !== 'available' && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-xs text-muted-foreground">Try:</span>
                              {suggestions.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => form.setValue('username', s, { shouldValidate: true })}
                                  className="rounded-full border border-border px-2.5 py-0.5 text-xs transition-colors hover:border-primary hover:text-foreground"
                                >
                                  @{s}
                                </button>
                              ))}
                            </div>
                          )}
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dateOfBirth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date of birth</FormLabel>
                          <FormControl>
                            <Input type="date" autoComplete="bday" min="1900-01-01" max={latestBirthDate()} className="h-11 dark:[color-scheme:dark]" {...field} />
                          </FormControl>
                          <FormDescription>You must be 13 or older. This isn’t shown on your profile.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                {step === 2 && (
                  <>
                    <FormField
                      control={form.control}
                      name="interests"
                      render={({ field, fieldState }) => (
                        <FormItem>
                          <FormLabel>What do you like to watch?</FormLabel>
                          <FormDescription>Pick at least one. We’ll use them to fill your home page.</FormDescription>
                          <InterestPicker value={field.value} onChange={(v) => field.onChange(v)} invalid={!!fieldState.error} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-3 rounded-xl border border-border p-4">
                      <FormField
                        control={form.control}
                        name="acceptTerms"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-start gap-3">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5 size-5" />
                              </FormControl>
                              <FormLabel className="block text-sm leading-snug font-normal">
                                I agree to the <span className="font-semibold">Terms of Service</span> and <span className="font-semibold">Privacy Policy</span>.
                              </FormLabel>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="marketingOptIn"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-start gap-3">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="mt-0.5 size-5" />
                              </FormControl>
                              <FormLabel className="block text-sm leading-snug font-normal text-muted-foreground">Send me occasional product news. (Optional)</FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              </motion.fieldset>
            </AnimatePresence>
          </div>

          <div className="flex gap-3">
            {step > 0 && (
              <Button type="button" variant="outline" className="h-11 rounded-xl" onClick={() => goTo(step - 1)}>
                <ArrowLeftIcon /> Back
              </Button>
            )}
            <Button type="submit" disabled={isSubmitting || (step === 1 && usernameStatus.state === 'checking')} className="h-11 flex-1 rounded-xl text-base">
              {isSubmitting && <Spinner />}
              {step < LAST ? 'Continue' : 'Create account'}
              {step < LAST && <ArrowRightIcon />}
            </Button>
          </div>
        </form>
      </Form>

      <AuthFooterLink prompt="Already have an account?" label="Log in" to="/login" />
    </AuthPanel>
  )
}
