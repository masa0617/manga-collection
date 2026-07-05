import type { Series, Volume } from '../types'
import { isFutureRelease, isRecentRelease } from './publishDate'

/**
 * Whether a volume newer than the ones the user owns has likely come out
 * recently. When the auto-estimate has found a volume beyond the highest one
 * owned, this uses the estimate's own release date - independent of what the
 * user owns - to judge recency. Without an estimate (or when it hasn't found
 * anything newer), falls back to treating "the latest volume I own was
 * itself released recently" as the best available proxy.
 *
 * Deliberately keyed off estimatedTotalVolumeCount specifically, not
 * manualTotalVolumeCount: the manual override is a display-only correction
 * to the *count* and carries no release date of its own, so estimated count
 * and estimated date are only meaningful as a pair.
 */
export function hasRecentNewRelease(series: Series, volumes: Volume[]): boolean {
  const ownedMax = volumes.reduce((max, v) => Math.max(max, v.volumeNumber), 0)

  if (series.estimatedTotalVolumeCount && series.estimatedTotalVolumeCount > ownedMax) {
    return isRecentRelease(series.estimatedLatestReleaseDateISO)
  }

  const latestOwned = volumes.reduce<Volume | undefined>(
    (latest, v) => (!latest || v.volumeNumber > latest.volumeNumber ? v : latest),
    undefined,
  )
  return isRecentRelease(latestOwned?.releaseDateISO)
}

export interface UpcomingRelease {
  volumeNumber: number
  dateISO: string
}

/**
 * A volume beyond what's owned that the estimate found but that hasn't been
 * published yet (a preorder/announced listing dated in the future). Distinct
 * from hasRecentNewRelease, which is reserved for volumes that have actually
 * come out - this is what drives the "発売予定日" preview instead.
 */
export function getUpcomingRelease(series: Series, volumes: Volume[]): UpcomingRelease | null {
  const ownedMax = volumes.reduce((max, v) => Math.max(max, v.volumeNumber), 0)
  const { estimatedTotalVolumeCount, estimatedLatestReleaseDateISO } = series
  if (!estimatedTotalVolumeCount || estimatedTotalVolumeCount <= ownedMax) return null
  if (!isFutureRelease(estimatedLatestReleaseDateISO)) return null
  return { volumeNumber: estimatedTotalVolumeCount, dateISO: estimatedLatestReleaseDateISO! }
}
