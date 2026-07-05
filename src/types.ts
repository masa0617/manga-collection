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
}
