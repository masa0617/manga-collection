import type { Series, Volume } from '../types'

// A cached estimatedTotalVolumeCount is only trustworthy if it's a positive
// number at least as large as the highest volume number the user actually
// owns - 0 (the old bug's failure value), undefined, or a count lower than
// what's owned are all impossible states for a real total, so they must be
// treated as "no usable estimate" rather than displayed. Shared by every
// place that reads estimatedTotalVolumeCount so this invariant can't drift
// out of sync between display and the background self-heal check (see
// volumeCheckScheduler).
export function isValidEstimatedTotal(estimatedTotal: number | undefined, ownedMax: number): boolean {
  return estimatedTotal !== undefined && estimatedTotal > 0 && estimatedTotal >= ownedMax
}

export function getOwnedMaxVolume(volumes: Pick<Volume, 'volumeNumber'>[]): number {
  return volumes.reduce((max, v) => Math.max(max, v.volumeNumber), 0)
}

// The number to show as "全n巻" - manualTotalVolumeCount always wins (it's an
// explicit user correction), otherwise estimatedTotalVolumeCount only if it
// passes isValidEstimatedTotal. Returns undefined when neither applies, in
// which case callers fall back to a plain owned-count display.
//
// A manual value is still clamped up to the owned max before display: it's
// meant to be a floor the user set at some point, not a promise that never
// goes stale, and volumes can be added faster than the background
// self-heal (see volumeCheckScheduler) gets a chance to persist the
// correction - this is the immediate, synchronous half of that guarantee,
// so a contradiction like "全2巻中12巻" is never even shown for a moment.
export function getDisplayTotalVolumeCount(
  series: Pick<Series, 'manualTotalVolumeCount' | 'estimatedTotalVolumeCount'>,
  volumes: Pick<Volume, 'volumeNumber'>[],
): number | undefined {
  const ownedMax = getOwnedMaxVolume(volumes)
  if (series.manualTotalVolumeCount) return Math.max(series.manualTotalVolumeCount, ownedMax)
  const est = series.estimatedTotalVolumeCount
  return isValidEstimatedTotal(est, ownedMax) ? est : undefined
}
