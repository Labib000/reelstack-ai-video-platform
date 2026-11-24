import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'

import { apiError } from '@/api/http'

/**
 * Puts a failed request's errors onto a react-hook-form form: per-field
 * messages (422, or 429 on login) under their fields, anything else as the
 * form-level `root` error.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
) {
  const info = apiError(error)
  let placed = false
  for (const [field, message] of Object.entries(info.fieldErrors)) {
    if ((fields as readonly string[]).includes(field)) {
      setError(field as Path<T>, { type: 'server', message })
      placed = true
    }
  }
  if (!placed) setError('root', { type: 'server', message: info.message })
}
