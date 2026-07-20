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

// A release counts as "past" (eligible for the 新刊 badge) from the moment
// its date has passed, with no cutoff after that - the badge is instead
// time-unbounded and only clears once the volume is actually registered
// (see hasNewRelease in newRelease.ts).
export function isPastRelease(dateISO: string | undefined, now: Date = new Date()): boolean {
  if (!dateISO) return false
  const released = new Date(dateISO)
  if (Number.isNaN(released.getTime())) return false
  return released.getTime() <= now.getTime()
}

// Whether a date is still ahead of now - used to tell an announced-but-not-
// yet-published volume (a preorder listing) apart from one that's already out.
export function isFutureRelease(dateISO: string | undefined, now: Date = new Date()): boolean {
  if (!dateISO) return false
  const released = new Date(dateISO)
  if (Number.isNaN(released.getTime())) return false
  return released.getTime() > now.getTime()
}

// How far ahead of a future release date the 予約 badge starts showing.
const RESERVATION_WINDOW_DAYS = 21

// True from RESERVATION_WINDOW_DAYS before a future release date up through
// the day before it (isFutureRelease itself becomes false once the release
// date's instant has passed, which is what ends the window on release day).
export function isWithinReservationWindow(dateISO: string | undefined, now: Date = new Date()): boolean {
  if (!isFutureRelease(dateISO, now)) return false
  const released = new Date(dateISO!)
  const daysUntil = (released.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return daysUntil <= RESERVATION_WINDOW_DAYS
}

export function formatJapaneseDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number)
  if (!y || !m || !d) return dateISO
  return `${y}年${m}月${d}日`
}
