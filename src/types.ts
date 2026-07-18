export interface Series {
  id: string
  name: string
  author: string
  createdAt: number
  publisher?: string
  // Best-effort imprint/label (e.g. "ジャンプ・コミックス"), the closest
  // structured field our sources expose to a serialization magazine.
  magazine?: string
  // Manual override for the representative cover, set from the series
  // detail screen. Takes priority over the auto-fetched minimum-volume cover.
  customCoverUrl?: string
  // Best-effort total volume count estimated from NDL Search (max volume
  // number seen across records matching this title+author), refreshed
  // opportunistically whenever a volume is added. Overridden by
  // manualTotalVolumeCount when the user sets one.
  estimatedTotalVolumeCount?: number
  // Release date (ISO) associated with the highest-numbered volume found
  // during that same estimate, independent of what the user actually owns -
  // used to tell "a newer volume than mine exists" apart from "my latest
  // volume happens to be new".
  estimatedLatestReleaseDateISO?: string
  // Manual override for the total volume count, set from the series detail
  // screen. Takes priority over estimatedTotalVolumeCount for display.
  manualTotalVolumeCount?: number
  // When the background volume-check scheduler last attempted (successfully
  // or not) to refresh estimatedTotalVolumeCount/estimatedLatestReleaseDateISO
  // for this series. Drives the check queue's "oldest first, at most every 6h"
  // ordering - set on every attempt (even a failed one) so a series whose
  // lookup keeps failing doesn't get hammered every app open.
  lastVolumeCheckAt?: number
  // Reading (katakana) used to sort this series in gojuuon (50-on) order,
  // captured opportunistically from NDL Search (see BookInfo.titleReading)
  // whenever a lookup for this series happens to return one. Left unset when
  // no source has ever supplied a reading, in which case sorting falls back
  // to the series name itself.
  kanaReading?: string
  // Where kanaReading came from - 'isbn' (a per-ISBN NDL lookup, which
  // targets one exact catalog record, so always reliable) or 'estimate' (the
  // title+author text search in estimateSeriesVolumes, which can currently
  // match tie-in material sharing the same title/author instead of the
  // series itself). Left unset for anything captured before this
  // distinction existed. Only an 'isbn' reading is treated as settled;
  // anything else stays eligible to be re-verified and overwritten by a
  // later, better estimate (see volumeCheckScheduler's kana-reading
  // migration) instead of being stuck on a possibly-wrong value forever.
  // 'generated' - a last-resort on-device reading (see kanaGenerator.ts)
  // used only when neither an isbn nor an estimate lookup ever found one.
  kanaReadingSource?: 'isbn' | 'estimate' | 'generated'
}

export interface WishlistItem {
  id: string
  title: string
  author?: string
  publisher?: string
  magazine?: string
  coverImageUrl?: string
  createdAt: number
  // Reading (katakana) used to sort this item in gojuuon (50-on) order.
  // Generated on-device from the title itself (see kanaGenerator.ts,
  // wishlistKanaScheduler) unless kanaReadingIsManual is set, in which case
  // it's a user-entered correction (WishlistFormScreen) that's never
  // overwritten by generation. Left unset when generation couldn't
  // confidently resolve a reading, in which case sorting falls back to the
  // title itself.
  kanaReading?: string
  // True when kanaReading was typed in directly via WishlistFormScreen
  // rather than generated - takes priority over generation forever, since a
  // manual correction (e.g. a title with wordplay/gikun kanaGenerator can't
  // know about) should never be silently clobbered by a later auto-generate
  // pass.
  kanaReadingIsManual?: boolean
}

export interface Volume {
  id: string
  seriesId: string
  volumeNumber: number
  isbn?: string
  coverImageUrl?: string
  publisher?: string
  // ISO date (YYYY-MM-DD) of this volume's release, when a source reports one.
  releaseDateISO?: string
  createdAt: number
}

export interface BackupMeta {
  key: 'backup'
  lastBackupAt: number
  addedSinceBackup: number
  // Highest ESTIMATE_ALGO_VERSION (see volumeCheckScheduler) whose forced
  // recheck migration has already run on this device. Whenever a change to
  // estimateSeriesVolumes' matching/parsing logic could make already-cached
  // estimatedTotalVolumeCount/kanaReading values wrong, ESTIMATE_ALGO_VERSION
  // is bumped and every series gets lastVolumeCheckAt cleared once so the
  // next background cycle re-verifies them immediately instead of waiting
  // out the normal 6h-per-series cooldown (or, worse, sitting on a bad
  // value indefinitely because nothing ever asks again). A single
  // incrementing counter instead of a one-off boolean flag per fix, so a
  // future correction only needs to bump the constant.
  appliedEstimateAlgoVersion?: number
  // Same idea as appliedEstimateAlgoVersion but for the wishlist's kana
  // reading generation (see WISHLIST_KANA_ALGO_VERSION in
  // wishlistKanaScheduler) - lets a fix to generateKanaReading force every
  // non-manual wishlist item's cached kanaReading to be regenerated once.
  appliedWishlistKanaAlgoVersion?: number
}

// Full-app JSON snapshot produced by exportAllData / shareOrDownloadJson and
// consumed by the backup-restore flow (see backupImport.ts). schemaVersion
// lets a future data-shape change refuse to import an incompatible file
// instead of silently corrupting the local DB - see
// backupImport.CURRENT_BACKUP_SCHEMA_VERSION.
export interface BackupExport {
  schemaVersion: number
  series: Series[]
  volumes: Volume[]
  wishlist: WishlistItem[]
  exportedAt: number
}

export interface BookInfo {
  title?: string
  author?: string
  publisher?: string
  coverImageUrl?: string
  // Structured volume number from a source that reports it separately from
  // the title (e.g. NDL Search's dcndl:volume), more reliable than parsing it
  // back out of a combined title string.
  volumeNumber?: number
  // Best-effort imprint/label, e.g. openBD's "series" field.
  magazine?: string
  // ISO date (YYYY-MM-DD) of the release, when a source reports one.
  releaseDateISO?: string
  // Reading (katakana) of the title, from NDL Search's dcndl:titleTranscription -
  // used to sort series in gojuuon (50-on) order regardless of whether the
  // title itself is in kanji, kana, or the Roman alphabet (e.g. "ONE PIECE").
  titleReading?: string
}
