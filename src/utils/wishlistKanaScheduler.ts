import { estimateSeriesVolumes } from '../api/bookLookup'
import { getAllWishlistItems, saveWishlistItem } from '../db'
import type { WishlistItem } from '../types'

// Mirrors volumeCheckScheduler's cooldown/concurrency approach, reused here
// so wishlist items can get a real kanaReading (see titleParsing.compareByKana)
// without hammering NDL Search on every app open. Only kanaReading is fetched
// here - wishlist items have no volume count to estimate.
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const CONCURRENCY = 2
const DELAY_BETWEEN_REQUESTS_MS = 500
const MAX_CYCLE_DURATION_MS = 3 * 60 * 1000

export interface WishlistKanaCheckCallbacks {
  onItemUpdated?: (item: WishlistItem) => void
}

let running = false

export async function runBackgroundWishlistKanaCheck(callbacks: WishlistKanaCheckCallbacks = {}): Promise<void> {
  if (running) return
  running = true
  try {
    const all = await getAllWishlistItems()
    const now = Date.now()
    // Once a reading is found it's kept forever (unlike Series, there's no
    // higher-confidence per-ISBN lookup for a wishlist item to eventually
    // upgrade to) - only items still missing one are ever re-checked, and
    // only after the cooldown so a title NDL genuinely has no record for
    // isn't retried every single cycle.
    const stale = all
      .filter((item) => !item.kanaReading && (!item.lastKanaCheckAt || now - item.lastKanaCheckAt >= RECHECK_INTERVAL_MS))
      .sort((a, b) => (a.lastKanaCheckAt ?? 0) - (b.lastKanaCheckAt ?? 0))

    if (stale.length === 0) return

    const deadline = Date.now() + MAX_CYCLE_DURATION_MS
    let nextIndex = 0

    async function worker() {
      while (nextIndex < stale.length && Date.now() < deadline) {
        const item = stale[nextIndex++]
        await checkOne(item, callbacks)
        await delay(DELAY_BETWEEN_REQUESTS_MS)
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, stale.length) }, worker))
  } finally {
    running = false
  }
}

async function checkOne(item: WishlistItem, callbacks: WishlistKanaCheckCallbacks): Promise<void> {
  const attemptedAt = Date.now()
  // A lookup failure must never surface anywhere in the UI - it should only
  // mean this item's sort position stays as-is (falls back to the title
  // itself), not that anything else breaks. Still record the attempt so a
  // persistently-failing item isn't retried every single app open.
  try {
    const estimate = await estimateSeriesVolumes(item.title, item.author)
    const updated: WishlistItem = {
      ...item,
      lastKanaCheckAt: attemptedAt,
      ...(estimate?.titleReading ? { kanaReading: estimate.titleReading } : {}),
    }
    await saveWishlistItem(updated)
    callbacks.onItemUpdated?.(updated)
  } catch (err) {
    console.error(err)
    try {
      const updated: WishlistItem = { ...item, lastKanaCheckAt: attemptedAt }
      await saveWishlistItem(updated)
      callbacks.onItemUpdated?.(updated)
    } catch {
      // IndexedDB write failure here shouldn't take down the rest of the
      // queue either - this item just gets retried sooner than intended.
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
