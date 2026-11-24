export interface PasswordScore {
  /** 0 (empty or very weak) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4
  label: 'Too weak' | 'Weak' | 'Okay' | 'Good' | 'Strong'
  checks: { length: boolean; letter: boolean; number: boolean; symbol: boolean }
  /** Meets the server's rule: 8+ characters with a letter and a number. */
  valid: boolean
}

const LABELS = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'] as const
const COMMON = ['password', 'qwerty', '12345678', '123456789', 'letmein', 'iloveyou', 'welcome', 'abc12345', 'password1', 'reelstack']

/** A quick, dependency-free strength estimate for the signup meter. */
export function scorePassword(password: string): PasswordScore {
  const checks = {
    length: password.length >= 8,
    letter: /\p{L}/u.test(password),
    number: /\d/.test(password),
    symbol: /[^\p{L}\d]/u.test(password),
  }
  const valid = checks.length && checks.letter && checks.number
  let score = Object.values(checks).filter(Boolean).length
  if (password.length >= 12) score += 1
  if (!valid) score = Math.min(score, 1)
  const lower = password.toLowerCase()
  if (!password || COMMON.some((c) => lower.includes(c)) || /^(.)\1+$/.test(password)) score = 0
  const clamped = Math.max(0, Math.min(4, score - 1 + (valid ? 1 : 0))) as PasswordScore['score']
  return { score: password ? clamped : 0, label: LABELS[password ? clamped : 0], checks, valid }
}
