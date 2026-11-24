import { zodResolver } from '@hookform/resolvers/zod'
import { type LoginInput, loginSchema } from '@reelstack/shared'
import { AlertCircleIcon, ArrowRightIcon, LogInIcon, ShieldCheckIcon, TriangleAlertIcon } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { useForm } from 'react-hook-form'

import { useAuth } from '@/auth/context'
import AuthFooterLink from '@/components/auth/AuthFooterLink'
import AuthHeader from '@/components/auth/AuthHeader'
import AuthPanel from '@/components/auth/AuthPanel'
import PasswordInput from '@/components/password-input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { applyServerErrors } from '@/lib/serverErrors'

export default function Login() {
  const { login } = useAuth()
  const [capsLock, setCapsLock] = useState(false)
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { isSubmitting, errors } = form.formState

  async function onSubmit(values: LoginInput) {
    try {
      // On success RequireGuest sends us on to ?next (or home).
      await login(values)
    } catch (error) {
      applyServerErrors(error, form.setError, ['email', 'password'])
    }
  }

  const trackCaps = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'))

  return (
    <AuthPanel>
      <AuthHeader icon={LogInIcon} title="Welcome back" subtitle="Log in to pick up where you left off, and ask your videos anything." />

      <Form {...form}>
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
          {errors.root && (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{errors.root.message}</AlertDescription>
            </Alert>
          )}
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
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} aria-disabled="true" className="cursor-not-allowed text-xs text-muted-foreground outline-none focus-visible:underline">
                        Forgot password?
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Password reset is coming soon</TooltipContent>
                  </Tooltip>
                </div>
                <FormControl>
                  <PasswordInput autoComplete="current-password" className="h-11" onKeyDown={trackCaps} onKeyUp={trackCaps} {...field} />
                </FormControl>
                {capsLock && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <TriangleAlertIcon className="size-3.5" /> Caps Lock is on
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isSubmitting} className="h-11 w-full rounded-xl text-base">
            {isSubmitting ? <Spinner /> : null}
            Log in
            {!isSubmitting && <ArrowRightIcon />}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-3.5" /> You’ll stay signed in on this device for 7 days.
          </p>
        </form>
      </Form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" /> New to ReelStack? <Separator className="flex-1" />
      </div>
      <AuthFooterLink prompt="" label="Create a free account" to="/register" />
    </AuthPanel>
  )
}
