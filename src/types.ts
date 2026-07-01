export interface Series {
  id: string
  name: string
  author: string
  createdAt: number
}

export interface Volume {
  id: string
  seriesId: string
  volumeNumber: number
  isbn?: string
  coverImageUrl?: string
  publisher?: string
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
}
