import { describe, expect, it } from 'vitest'

import { latestBirthDate, registerFormSchema, stepOfField, suggestUsernames } from './register-form'

const valid = {
  email: 'ada@example.com',
  password: 'analytical-engine-1',
  confirmPassword: 'analytical-engine-1',
  name: 'Ada Lovelace',
  username: 'ada.lovelace',
  dateOfBirth: '1990-12-10',
  interests: ['Science'],
  acceptTerms: true,
  marketingOptIn: false,
}

const errorPaths = (input: unknown) => {
  const r = registerFormSchema.safeParse(input)
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'))
}

describe('registerFormSchema', () => {
  it('accepts a complete signup', () => {
    expect(errorPaths(valid)).toEqual([])
  })

  it('reports a confirm mismatch even while later steps are empty', () => {
    const paths = errorPaths({ email: 'ada@example.com', password: 'analytical-engine-1', confirmPassword: 'nope' })
    expect(paths).toContain('confirmPassword')
  })

  it('requires the terms to be accepted', () => {
    expect(errorPaths({ ...valid, acceptTerms: false })).toEqual(['acceptTerms'])
  })
})

describe('register helpers', () => {
  it('maps fields to their step', () => {
    expect(stepOfField('email')).toBe(0)
    expect(stepOfField('username')).toBe(1)
    expect(stepOfField('acceptTerms')).toBe(2)
  })

  it('gives a birth date limit exactly 13 years back', () => {
    expect(latestBirthDate(new Date('2026-11-24T10:00:00Z'))).toBe('2013-11-24')
  })

  it('suggests valid handles from a name', () => {
    expect(suggestUsernames('Zoë Ångström')).toEqual(['zoe.angstrom', 'zoeangstrom', 'zoe_a'])
    expect(suggestUsernames('42')[0]).toBe('u42')
    expect(suggestUsernames('')).toEqual([])
  })
})
