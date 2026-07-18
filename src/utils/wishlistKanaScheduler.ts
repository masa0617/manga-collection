import { generateKanaReading } from './kanaGenerator'
import { getAllWishlistItems, saveWishlistItem, getBackupMeta, saveBackupMeta } from '../db'
import type { WishlistItem } from '../types'

export interface WishlistKanaCheckCallbacks {
  onItemUpdated?: (item: WishlistItem) => void
}

// Bump whenever a change to generateKanaReading's logic could make an
// already-cached kanaReading wrong or newly resolvable for existing
// wishlist items - forces every non-manual item's kanaReading back to
// "unresolved" once so the next check regenerates it immediately instead of
// sitting on a stale/wrong value forever. Mirrors
// volumeCheckScheduler.ESTIMATE_ALGO_VERSION.
//   1 - switch from NDL text-search (unreliable for hand-typed titles with
//       no ISBN to corroborate a fuzzy match - see the wishlist kana sort
//       investigation) to on-device kuromoji-based generation.
const WISHLIST_KANA_ALGO_VERSION = 1

async function runKanaAlgoMigration(): Promise<void> {
  const meta = await getBackupMeta()
  if ((meta.appliedWishlistKanaAlgoVersion ?? 0) >= WISHLIST_KANA_ALGO_VERSION) return
  const all = await getAllWishlistItems()
  await Promise.all(
    all
      .filter((item) => !item.kanaReadingIsManual && item.kanaReading)
      .map((item) => saveWishlistItem({ ...item, kanaReading: undefined })),
  )
  await saveBackupMeta({ ...meta, appliedWishlistKanaAlgoVersion: WISHLIST_KANA_ALGO_VERSION })
}

// Guards against overlapping runs (e.g. effects re-running), not a proper
// queue/lock, since only one run needs to ever be active at a time.
let running = false

// Generation is a local, deterministic computation (no network, no rate
// limit, no "maybe it'll work later" flakiness) - unlike the NDL-based
// volumeCheckScheduler this replaced, there's no cooldown/pacing needed.
// A title that fails to resolve will fail the same way every time, so it's
// simply left alone (falls back to the title-text tail-group sort rule in
// titleParsing.ts) rather than retried on a timer.
export async function runBackgroundWishlistKanaCheck(callbacks: WishlistKanaCheckCallbacks = {}): Promise<void> {
  if (running) return
  running = true
  try {
    await runKanaAlgoMigration()
    const all = await getAllWishlistItems()
    const pending = all.filter((item) => !item.kanaReadingIsManual && !item.kanaReading)
    for (const item of pending) {
      const reading = await generateKanaReading(item.title)
      if (!reading) continue
      const updated: WishlistItem = { ...item, kanaReading: reading }
      await saveWishlistItem(updated)
      callbacks.onItemUpdated?.(updated)
    }
  } finally {
    running = false
  }
}
