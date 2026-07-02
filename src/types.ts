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
