// Normalizes the loosely-formatted publish dates the lookup APIs return
// (openBD's pubdate is "YYYYMMDD"/"YYYYMM"/"YYYY"/"", Google's publishedDate
// is "YYYY-MM-DD"/"YYYY-MM"/"YYYY") into a comparable "YYYY-MM-DD" string.
export function parsePublishDate(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  const digitsOnly = raw.replace(/[^0-9]/g, '')
  if (digitsOnly.length >= 8) {
    return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-${digitsOnly.slice(6, 8)}`
  }
  if (digitsOnly.length >= 6) {
    return `${digitsOnly.slice(0, 4)}-${digitsOnly.slice(4, 6)}-01`
  }
  if (digitsOnly.length >= 4) {
    return `${digitsOnly.slice(0, 4)}-01-01`
  }
  return undefined
}

const NEW_RELEASE_WINDOW_DAYS = 14

export function isRecentRelease(dateISO: string | undefined, now: Date = new Date()): boolean {
  if (!dateISO) return false
  const released = new Date(dateISO)
  if (Number.isNaN(released.getTime())) return false
  const daysSince = (now.getTime() - released.getTime()) / (1000 * 60 * 60 * 24)
  return daysSince >= 0 && daysSince <= NEW_RELEASE_WINDOW_DAYS
}

// Whether a date is still ahead of now - used to tell an announced-but-not-
// yet-published volume (a preorder listing) apart from one that's already out.
export function isFutureRelease(dateISO: string | undefined, now: Date = new Date()): boolean {
  if (!dateISO) return false
  const released = new Date(dateISO)
  if (Number.isNaN(released.getTime())) return false
  return released.getTime() > now.getTime()
}

export function formatJapaneseDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  if (!y || !m || !d) return dateISO
  return `${y}年${m}月${d}日`
}
