import { estimateSeriesVolumes } from '../api/bookLookup'
import { getAllSeries, saveSeries, getBackupMeta, saveBackupMeta } from '../db'
import type { Series } from '../types'

// With collections in the hundreds-to-thousands of series, refreshing every
// series on every app open would mean a burst of hundreds of requests against
// a free public API each time the app is opened. Instead, only series whose
// last check is older than this get re-checked at all, oldest-checked first,
// so the load spreads out across app opens over time instead of spiking.
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
// At most this many requests in flight at once, paced by DELAY_BETWEEN...
// below - keeps this a "gentle background trickle" against NDL rather than a
// burst, regardless of how many series are due for a check.
const CONCURRENCY = 2
const DELAY_BETWEEN_REQUESTS_MS = 500
// Bounds how long a single cycle keeps making new requests, so one very
// large backlog (e.g. first run on a ~2000-series collection) doesn't run
// unbounded in one go. Whatever's left over is simply picked up by the next
// cycle (triggered again on an interval - see App.tsx) or the next app open.
const MAX_CYCLE_DURATION_MS = 3 * 60 * 1000

export interface VolumeCheckCallbacks {
  onSeriesUpdated?: (series: Series) => void
}

// Guards against overlapping cycles (e.g. effects re-running) rather than a
// proper queue/lock, since only one cycle needs to ever be active at a time.
let running = false

// One-time, per-device migration: a past version of estimateSeriesVolumes
// could match tie-in material (character books, novelizations, ...) instead
// of the series itself and cache its reading as Series.kanaReading, e.g.
// sorting "BLEACH" under "ア" instead of "ブ". That's now filtered out, but a
// contaminated reading already saved is never revisited by the normal check
// below (kanaReadingSource !== 'isbn' is the only gate on overwriting it,
// and lastVolumeCheckAt is already recent from the run that cached it) -
// this forces exactly those series back into the "due" pool once so they
// get re-verified against the fixed matching logic right away instead of
// waiting out their existing 6h cooldown.
async function runKanaReadingMigrationOnce(): Promise<void> {
  const meta = await getBackupMeta()
  if (meta.kanaMigrationDoneAt) return
  const all = await getAllSeries()
  const affected = all.filter((s) => s.kanaReadingSource !== 'isbn')
  await Promise.all(affected.map((s) => saveSeries({ ...s, lastVolumeCheckAt: undefined })))
  await saveBackupMeta({ ...meta, kanaMigrationDoneAt: Date.now() })
}

export async function runBackgroundVolumeCheck(callbacks: VolumeCheckCallbacks = {}): Promise<void> {
  if (running) return
  running = true
  try {
    await runKanaReadingMigrationOnce()
    const all = await getAllSeries()
    const now = Date.now()
    const stale = all
      .filter((s) => !s.lastVolumeCheckAt || now - s.lastVolumeCheckAt >= RECHECK_INTERVAL_MS)
      .sort((a, b) => (a.lastVolumeCheckAt ?? 0) - (b.lastVolumeCheckAt ?? 0))

    if (stale.length === 0) return

    const deadline = Date.now() + MAX_CYCLE_DURATION_MS
    let nextIndex = 0

    async function worker() {
      while (nextIndex < stale.length && Date.now() < deadline) {
        const series = stale[nextIndex++]
        await checkOne(series, callbacks)
        await delay(DELAY_BETWEEN_REQUESTS_MS)
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, stale.length) }, worker))
  } finally {
    running = false
  }
}

async function checkOne(series: Series, callbacks: VolumeCheckCallbacks): Promise<void> {
  const attemptedAt = Date.now()
  // A lookup failure (network error, NDL outage, rate limiting, ...) must
  // never surface to the caller - it should only mean this series' badge/
  // count data stays as last known-good, not that anything else in the app
  // breaks. Still record the attempt so a persistently-failing series is
  // retried after the next cooldown instead of every single app open.
  try {
    const estimate = await estimateSeriesVolumes(series.name, series.author)
    const updated: Series = {
      ...series,
      lastVolumeCheckAt: attemptedAt,
      ...(estimate
        ? {
            estimatedTotalVolumeCount: estimate.totalVolumeCount,
            estimatedLatestReleaseDateISO: estimate.latestReleaseDateISO,
            // Never overrides an 'isbn' reading, see Series.kanaReadingSource.
            ...(series.kanaReadingSource !== 'isbn' && estimate.titleReading
              ? { kanaReading: estimate.titleReading, kanaReadingSource: 'estimate' as const }
              : {}),
          }
        : {}),
    }
    await saveSeries(updated)
    callbacks.onSeriesUpdated?.(updated)
  } catch (err) {
    console.error(err)
    try {
      const updated: Series = { ...series, lastVolumeCheckAt: attemptedAt }
      await saveSeries(updated)
      callbacks.onSeriesUpdated?.(updated)
    } catch {
      // IndexedDB write failure here shouldn't take down the rest of the
      // queue either - this series just gets retried sooner than intended.
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
