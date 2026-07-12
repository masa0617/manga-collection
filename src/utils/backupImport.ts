import { BACKUP_SCHEMA_VERSION } from '../db'
import type { BackupExport, Series, Volume, WishlistItem } from '../types'

export type BackupParseResult = { ok: true; data: BackupExport } | { ok: false; error: string }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// Deliberately checks only the handful of fields the rest of the app
// actually depends on (id/name/createdAt etc.) rather than every optional
// field - an export from an older or newer app version should still import
// as long as those load-bearing fields are shaped correctly; anything else
// just rides along as extra/missing optional data the same way it already
// does for records synced across app updates.
function isValidSeries(v: unknown): v is Series {
  return isPlainObject(v) && typeof v.id === 'string' && typeof v.name === 'string' && typeof v.createdAt === 'number'
}

function isValidVolume(v: unknown): v is Volume {
  return (
    isPlainObject(v) &&
    typeof v.id === 'string' &&
    typeof v.seriesId === 'string' &&
    typeof v.volumeNumber === 'number' &&
    typeof v.createdAt === 'number'
  )
}

function isValidWishlistItem(v: unknown): v is WishlistItem {
  return isPlainObject(v) && typeof v.id === 'string' && typeof v.title === 'string' && typeof v.createdAt === 'number'
}

// Parses and validates a backup JSON file's raw text before it's ever
// allowed near the DB - a malformed or unrelated file must fail here with a
// clear reason, not partway through a write. A missing/non-array
// `wishlist` is tolerated (treated as empty) since it lets a backup taken
// before the wishlist feature existed still restore the owned collection.
export function parseBackupFile(raw: string): BackupParseResult {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'ファイルの形式が正しくありません（JSONとして読み込めませんでした）。' }
  }

  if (!isPlainObject(json)) {
    return { ok: false, error: 'バックアップファイルの形式が正しくありません。' }
  }

  // Backups taken before schemaVersion existed have no such field at all -
  // treated as version 1, the only shape that predates it.
  const schemaVersion = typeof json.schemaVersion === 'number' ? json.schemaVersion : 1
  if (schemaVersion > BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      error: 'このバックアップファイルは新しいバージョンのアプリで作成されています。アプリを更新してから復元してください。',
    }
  }

  if (!Array.isArray(json.series) || !json.series.every(isValidSeries)) {
    return { ok: false, error: 'バックアップファイルの形式が正しくありません（蔵書データが見つからないか、壊れています）。' }
  }
  if (!Array.isArray(json.volumes) || !json.volumes.every(isValidVolume)) {
    return { ok: false, error: 'バックアップファイルの形式が正しくありません（巻データが見つからないか、壊れています）。' }
  }
  const wishlist = Array.isArray(json.wishlist) ? json.wishlist : []
  if (!wishlist.every(isValidWishlistItem)) {
    return { ok: false, error: 'バックアップファイルの形式が正しくありません（ほしいものリストデータが壊れています）。' }
  }

  return {
    ok: true,
    data: {
      schemaVersion,
      series: json.series,
      volumes: json.volumes,
      wishlist,
      exportedAt: typeof json.exportedAt === 'number' ? json.exportedAt : Date.now(),
    },
  }
}
