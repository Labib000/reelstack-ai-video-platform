import type { LoginInput, RegisterInput, UserDTO } from '@reelstack/shared'
import { createContext, useContext } from 'react'

export type AuthStatus = 'loading' | 'authenticated' | 'guest'

export interface AuthContextValue {
  status: AuthStatus
  user: UserDTO | null
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  /** Signs this device out. */
  logout: () => Promise<void>
  /** Signs every device out (and kills their access tokens). */
  logoutAll: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
