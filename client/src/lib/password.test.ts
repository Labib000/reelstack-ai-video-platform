import { describe, expect, it } from 'vitest'

import { scorePassword } from './password'

describe('scorePassword', () => {
  it('is zero for empty and common passwords', () => {
    expect(scorePassword('').score).toBe(0)
    expect(scorePassword('Password123!').score).toBe(0)
    expect(scorePassword('aaaaaaaaaaaa').score).toBe(0)
  })

  it('caps passwords that miss the rule at weak', () => {
    const s = scorePassword('only-letters-here')
    expect(s.valid).toBe(false)
    expect(s.score).toBeLessThanOrEqual(1)
  })

  it('rewards length and symbols once the rule is met', () => {
    const basic = scorePassword('sunset42')
    const strong = scorePassword('violet-Sunset-42')
    expect(basic.valid).toBe(true)
    expect(strong.score).toBeGreaterThan(basic.score)
    expect(strong.label).toBe('Strong')
  })
})
