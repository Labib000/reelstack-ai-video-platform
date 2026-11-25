/** A staff member's remembered answer to "Admin console or ReelStack?" after login. */
export type StaffLanding = 'admin' | 'app'

const key = (userId: string) => `reelstack:staff-landing:${userId}`

export function getStaffLanding(userId: string): StaffLanding | null {
  try {
    const v = localStorage.getItem(key(userId))
    return v === 'admin' || v === 'app' ? v : null
  } catch {
    return null
  }
}

export function setStaffLanding(userId: string, value: StaffLanding | null) {
  try {
    if (value) localStorage.setItem(key(userId), value)
    else localStorage.removeItem(key(userId))
  } catch {
    // Storage blocked: they'll just be asked again.
  }
}

export const landingPath = (v: StaffLanding) => (v === 'admin' ? '/admin' : '/')
