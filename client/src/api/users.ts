import type { UsernameAvailability } from '@reelstack/shared'

import { api } from './http'

/** Live @handle availability for the signup form. */
export async function checkUsername(username: string, signal?: AbortSignal): Promise<UsernameAvailability> {
  const res = await api.get<UsernameAvailability>('/auth/username-available', { params: { username }, signal })
  return res.data
}
