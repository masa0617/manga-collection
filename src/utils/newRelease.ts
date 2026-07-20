import type { Series, Volume } from '../types'
import { isPastRelease, isWithinReservationWindow } from './publishDate'

/**
 * Whether the volume beyond the highest one owned has already come out. Keyed
 * off estimatedTotalVolumeCount specifically, not manualTotalVolumeCount: the
 * manual override is a display-only correction to the *count* and carries no
 * release date of its own, so estimated count and estimated date are only
 * meaningful as a pair.
 *
 * Whether that next volume "counts" as new is purely: is there one beyond
 * what's owned (estimatedTotalVolumeCount > ownedMax - i.e. the "全n巻" figure
 * doesn't match what's actually registered yet), and has its release date
 * passed. No recency window - it stays true, with no automatic expiry, until
 * the volume is actually registered and ownedMax catches up.
 *
 * A completed series (series.isCompleted) is excluded outright - see
 * volumeCheckScheduler, which also stops refreshing its estimate entirely.
 */
export function hasNewRelease(series: Series, volumes: Volume[]): boolean {
  if (series.isCompleted) return false
  const ownedMax = volumes.reduce((max, v) => Math.max(max, v.volumeNumber), 0)
  if (!series.estimatedTotalVolumeCount || series.estimatedTotalVolumeCount <= ownedMax) return false
  return isPastRelease(series.estimatedLatestReleaseDateISO)
}

export interface UpcomingRelease {
  volumeNumber: number
  dateISO: string
}

/**
 * A volume beyond what's owned that the estimate found but that hasn't been
 * published yet (a preorder/announced listing dated in the future), and whose
 * release date is within the reservation window (see
 * isWithinReservationWindow - 3 weeks out). Distinct from hasNewRelease,
 * which is reserved for volumes that have actually come out - this is what
 * drives the "発売予定日" preview and 予約 badge instead.
 */
export function getUpcomingRelease(series: Series, volumes: Volume[]): UpcomingRelease | null {
  if (series.isCompleted) return null
  const ownedMax = volumes.reduce((max, v) => Math.max(max, v.volumeNumber), 0)
  const { estimatedTotalVolumeCount, estimatedLatestReleaseDateISO } = series
  if (!estimatedTotalVolumeCount || estimatedTotalVolumeCount <= ownedMax) return null
  if (!isWithinReservationWindow(estimatedLatestReleaseDateISO)) return null
  return { volumeNumber: estimatedTotalVolumeCount, dateISO: estimatedLatestReleaseDateISO! }
}
