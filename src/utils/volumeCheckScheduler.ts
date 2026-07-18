import { estimateSeriesVolumes } from '../api/bookLookup'
import { getAllSeries, getAllVolumes, saveSeries, getBackupMeta, saveBackupMeta } from '../db'
import type { Series } from '../types'
import { isValidEstimatedTotal } from './volumeEstimate'
import { generateKanaReading } from './kanaGenerator'

// A manual total is contradicted when it's set but doesn't cover what's
// actually owned - see getDisplayTotalVolumeCount's display-time clamp for
// the immediate half of this guarantee; this is the persisted half.
function isManualTotalContradicted(series: Series, ownedMax: number): boolean {
  return series.manualTotalVolumeCount !== undefined && series.manualTotalVolumeCount < ownedMax
}

// With collections in the hundreds-to-thousands of series, refreshing every
// series on every app open would mean a burst of hundreds of requests against
// a free public API each time the app is opened. Instead, only series whose
// last check is older than this get re-checked at all, oldest-checked first,
// so the load spreads out across app opens over time instead of spiking.
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
// Shorter cooldown used only for the self-heal path below - long enough that
// a series NDL genuinely has no usable record for isn't hammered on every
// app open/retrigger forever, short enough that a stale bad value (e.g. the
// old 0-count bug) gets fixed within the hour instead of waiting out the
// full 6h cooldown.
const SELF_HEAL_RECHECK_INTERVAL_MS = 30 * 60 * 1000
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

// Bump whenever a change to estimateSeriesVolumes' matching/parsing logic
// (or how a caller interprets its result) could make an already-cached
// estimatedTotalVolumeCount/kanaReading wrong. See runEstimateAlgoMigration
// and BackupMeta.appliedEstimateAlgoVersion.
//   1 - kana-reading contamination fix (tie-in material matched as the
//       series itself, e.g. BLEACH sorted under "ア" instead of "ブ").
//   2 - totalVolumeCount regex fix for full-width digits, "その1" counters,
//       and arc-name-suffixed dcndl:volume labels (BLEACH/月曜日のたわわ
//       stuck at 0).
//   3 - added an on-device kanaReading fallback (see kanaGenerator.ts) for
//       series where neither an isbn nor an estimate lookup ever found a
//       reading, so already-registered series stuck in the sort's "unknown
//       reading" tail group get a shot at resolving immediately.
//   4 - stricter non-canon-material exclusion (NDC classification + title
//       keywords - fan books, novelizations, anime tie-ins) and
//       author-corroborated matching in estimateSeriesVolumes, plus
//       self-healing a manualTotalVolumeCount that's fallen below what's
//       owned or below a fresh valid estimate.
const ESTIMATE_ALGO_VERSION = 4

// One-time-per-version, per-device migration: forces every series back into
// the "due" pool once after an algorithm fix, bypassing the normal 6h
// cooldown, so already-cached bad values (a wrong kanaReading, or a
// totalVolumeCount stuck at 0) get re-verified right away instead of sitting
// wrong for up to 6h after the app updates - or, since lastVolumeCheckAt is
// already recent from the run that cached the bad value, indefinitely.
async function runEstimateAlgoMigration(): Promise<void> {
  const meta = await getBackupMeta()
  if ((meta.appliedEstimateAlgoVersion ?? 0) >= ESTIMATE_ALGO_VERSION) return
  const all = await getAllSeries()
  await Promise.all(all.map((s) => saveSeries({ ...s, lastVolumeCheckAt: undefined })))
  await saveBackupMeta({ ...meta, appliedEstimateAlgoVersion: ESTIMATE_ALGO_VERSION })
}

export async function runBackgroundVolumeCheck(callbacks: VolumeCheckCallbacks = {}): Promise<void> {
  if (running) return
  running = true
  try {
    await runEstimateAlgoMigration()
    const [all, volumes] = await Promise.all([getAllSeries(), getAllVolumes()])
    const ownedMaxBySeriesId = new Map<string, number>()
    for (const v of volumes) {
      ownedMaxBySeriesId.set(v.seriesId, Math.max(ownedMaxBySeriesId.get(v.seriesId) ?? 0, v.volumeNumber))
    }
    const now = Date.now()
    const stale = all
      .filter((s) => {
        if (!s.lastVolumeCheckAt || now - s.lastVolumeCheckAt >= RECHECK_INTERVAL_MS) return true
        // Self-heal: an already-impossible cached estimate (0, or lower than
        // a volume number actually owned) or a contradicted manual total
        // must not sit wrong until the next full cooldown - see
        // isValidEstimatedTotal/isManualTotalContradicted. Gated on the
        // shorter SELF_HEAL_RECHECK_INTERVAL_MS rather than retried
        // unconditionally, so a series NDL genuinely has no record for
        // doesn't get hit on every single cycle forever.
        if (now - (s.lastVolumeCheckAt ?? 0) >= SELF_HEAL_RECHECK_INTERVAL_MS) {
          const ownedMax = ownedMaxBySeriesId.get(s.id) ?? 0
          if (s.estimatedTotalVolumeCount !== undefined && !isValidEstimatedTotal(s.estimatedTotalVolumeCount, ownedMax)) {
            return true
          }
          if (isManualTotalContradicted(s, ownedMax)) return true
        }
        return false
      })
      .sort((a, b) => (a.lastVolumeCheckAt ?? 0) - (b.lastVolumeCheckAt ?? 0))

    if (stale.length === 0) return

    const deadline = Date.now() + MAX_CYCLE_DURATION_MS
    let nextIndex = 0

    async function worker() {
      while (nextIndex < stale.length && Date.now() < deadline) {
        const series = stale[nextIndex++]
        await checkOne(series, ownedMaxBySeriesId.get(series.id) ?? 0, callbacks)
        await delay(DELAY_BETWEEN_REQUESTS_MS)
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, stale.length) }, worker))
  } finally {
    running = false
  }
}

async function checkOne(series: Series, ownedMax: number, callbacks: VolumeCheckCallbacks): Promise<void> {
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
      // A search that came back with no usable volume number (see
      // SeriesVolumeEstimate.totalVolumeCount) must leave an already-cached
      // total alone rather than blank it out - this recheck runs on every
      // series every few hours, so a single noisy/incomplete NDL response
      // must never regress a count that was previously found successfully.
      ...(estimate?.totalVolumeCount
        ? {
            estimatedTotalVolumeCount: estimate.totalVolumeCount,
            estimatedLatestReleaseDateISO: estimate.latestReleaseDateISO,
          }
        : {}),
      // Never overrides an 'isbn' reading, see Series.kanaReadingSource.
      ...(series.kanaReadingSource !== 'isbn' && estimate?.titleReading
        ? { kanaReading: estimate.titleReading, kanaReadingSource: 'estimate' as const }
        : {}),
    }
    const final = withCorrectedManualTotal(await withGeneratedKanaFallback(updated), ownedMax, estimate?.totalVolumeCount)
    await saveSeries(final)
    callbacks.onSeriesUpdated?.(final)
  } catch (err) {
    console.error(err)
    try {
      const updated: Series = { ...series, lastVolumeCheckAt: attemptedAt }
      const final = withCorrectedManualTotal(await withGeneratedKanaFallback(updated), ownedMax)
      await saveSeries(final)
      callbacks.onSeriesUpdated?.(final)
    } catch {
      // IndexedDB write failure here shouldn't take down the rest of the
      // queue either - this series just gets retried sooner than intended.
    }
  }
}

// Bumps a manual total up (never down - it's still the user's floor) when
// it's fallen below what's actually owned, or below a freshly-found valid
// estimate (e.g. a new volume was catalogued after the user set the manual
// value). Never touches a series with no manual value set at all.
function withCorrectedManualTotal(series: Series, ownedMax: number, freshEstimate?: number): Series {
  if (series.manualTotalVolumeCount === undefined) return series
  const corrected = Math.max(series.manualTotalVolumeCount, ownedMax, freshEstimate ?? 0)
  return corrected === series.manualTotalVolumeCount ? series : { ...series, manualTotalVolumeCount: corrected }
}

// Last-resort fallback for a series still stuck with no reading after both
// the isbn and estimate paths above have had their say - runs entirely
// on-device (see kanaGenerator.ts) so it still has a shot even when NDL is
// down/failing, unlike the two lookups it backs up. Never overrides an
// existing kanaReading of any source - purely fills a gap.
async function withGeneratedKanaFallback(series: Series): Promise<Series> {
  if (series.kanaReading) return series
  const generated = await generateKanaReading(series.name)
  if (!generated) return series
  return { ...series, kanaReading: generated, kanaReadingSource: 'generated' }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
