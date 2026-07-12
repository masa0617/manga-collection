import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Series, Volume, BackupMeta, WishlistItem, BackupExport } from './types'
import { normalizeForMatch } from './utils/titleParsing'

// Bump whenever a change to Series/Volume/WishlistItem's shape could make an
// older exported JSON incompatible with what restoreAllData/mergeAllData
// expect - see backupImport.parseBackupFile, which refuses to import a file
// whose schemaVersion is newer than this.
export const BACKUP_SCHEMA_VERSION = 1

interface MangaDB extends DBSchema {
  series: {
    key: string
    value: Series
  }
  volumes: {
    key: string
    value: Volume
    indexes: { seriesId: string }
  }
  meta: {
    key: string
    value: BackupMeta
  }
  wishlist: {
    key: string
    value: WishlistItem
  }
}

const DB_NAME = 'manga-collection'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase<MangaDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MangaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('series')) {
          db.createObjectStore('series', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('volumes')) {
          const store = db.createObjectStore('volumes', { keyPath: 'id' })
          store.createIndex('seriesId', 'seriesId')
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' })
        }
        // Independent of series/volumes by design - a wishlist entry never
        // shares a store (or an id namespace) with an owned series, so the
        // two lists can never get mixed up.
        if (!db.objectStoreNames.contains('wishlist')) {
          db.createObjectStore('wishlist', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function getAllSeries(): Promise<Series[]> {
  const db = await getDb()
  return db.getAll('series')
}

export async function getSeriesById(id: string): Promise<Series | undefined> {
  const db = await getDb()
  return db.get('series', id)
}

export async function findSeriesByName(name: string): Promise<Series | undefined> {
  const all = await getAllSeries()
  const normalized = normalizeForMatch(name)
  return all.find((s) => normalizeForMatch(s.name) === normalized)
}

export async function saveSeries(series: Series): Promise<void> {
  const db = await getDb()
  await db.put('series', series)
}

export async function deleteSeries(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['series', 'volumes'], 'readwrite')
  await tx.objectStore('series').delete(id)
  const volIndex = tx.objectStore('volumes').index('seriesId')
  let cursor = await volIndex.openCursor(IDBKeyRange.only(id))
  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }
  await tx.done
}

export async function getAllVolumes(): Promise<Volume[]> {
  const db = await getDb()
  return db.getAll('volumes')
}

export async function getVolumesBySeries(seriesId: string): Promise<Volume[]> {
  const db = await getDb()
  return db.getAllFromIndex('volumes', 'seriesId', seriesId)
}

export async function saveVolume(volume: Volume): Promise<void> {
  const db = await getDb()
  await db.put('volumes', volume)
}

export async function deleteVolume(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('volumes', id)
}

export async function getBackupMeta(): Promise<BackupMeta> {
  const db = await getDb()
  const existing = await db.get('meta', 'backup')
  if (existing) return existing
  const initial: BackupMeta = { key: 'backup', lastBackupAt: Date.now(), addedSinceBackup: 0 }
  await db.put('meta', initial)
  return initial
}

export async function saveBackupMeta(meta: BackupMeta): Promise<void> {
  const db = await getDb()
  await db.put('meta', meta)
}

export async function recordVolumeAdded(): Promise<void> {
  const meta = await getBackupMeta()
  meta.addedSinceBackup += 1
  await saveBackupMeta(meta)
}

export async function markBackedUp(): Promise<void> {
  await saveBackupMeta({ key: 'backup', lastBackupAt: Date.now(), addedSinceBackup: 0 })
}

export async function getAllWishlistItems(): Promise<WishlistItem[]> {
  const db = await getDb()
  return db.getAll('wishlist')
}

export async function saveWishlistItem(item: WishlistItem): Promise<void> {
  const db = await getDb()
  await db.put('wishlist', item)
}

export async function deleteWishlistItem(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('wishlist', id)
}

export async function exportAllData(): Promise<BackupExport> {
  const [series, volumes, wishlist] = await Promise.all([getAllSeries(), getAllVolumes(), getAllWishlistItems()])
  return { schemaVersion: BACKUP_SCHEMA_VERSION, series, volumes, wishlist, exportedAt: Date.now() }
}

interface RestoreData {
  series: Series[]
  volumes: Volume[]
  wishlist: WishlistItem[]
}

// Restore mode 1/2: wipes the owned collection and wishlist entirely and
// replaces them with exactly what the backup file contains. Deliberately
// leaves the `meta` store untouched - the backup-reminder cadence
// (BackupMeta.lastBackupAt/addedSinceBackup) isn't part of what a user
// means by "restore my data".
export async function replaceAllData(data: RestoreData): Promise<void> {
  const db = await getDb()
  const tx = db.transaction(['series', 'volumes', 'wishlist'], 'readwrite')
  await tx.objectStore('series').clear()
  await tx.objectStore('volumes').clear()
  await tx.objectStore('wishlist').clear()
  await Promise.all([
    ...data.series.map((s) => tx.objectStore('series').put(s)),
    ...data.volumes.map((v) => tx.objectStore('volumes').put(v)),
    ...data.wishlist.map((w) => tx.objectStore('wishlist').put(w)),
  ])
  await tx.done
}

export interface MergeResult {
  addedSeries: number
  addedVolumes: number
  addedWishlist: number
}

// Restore mode 2/2: additive only. An id already present locally is assumed
// to be the same record (ids are generated once via crypto.randomUUID and
// carried through every export since), so it's left alone rather than
// overwritten - this keeps merge simple and side-effect-free instead of
// having to reconcile which of two diverged copies of the same id "wins".
export async function mergeAllData(data: RestoreData): Promise<MergeResult> {
  const db = await getDb()
  const [existingSeries, existingVolumes, existingWishlist] = await Promise.all([
    db.getAll('series'),
    db.getAll('volumes'),
    db.getAll('wishlist'),
  ])
  const existingSeriesIds = new Set(existingSeries.map((s) => s.id))
  const existingVolumeIds = new Set(existingVolumes.map((v) => v.id))
  const existingWishlistIds = new Set(existingWishlist.map((w) => w.id))

  const newSeries = data.series.filter((s) => !existingSeriesIds.has(s.id))
  const newVolumes = data.volumes.filter((v) => !existingVolumeIds.has(v.id))
  const newWishlist = data.wishlist.filter((w) => !existingWishlistIds.has(w.id))

  const tx = db.transaction(['series', 'volumes', 'wishlist'], 'readwrite')
  await Promise.all([
    ...newSeries.map((s) => tx.objectStore('series').put(s)),
    ...newVolumes.map((v) => tx.objectStore('volumes').put(v)),
    ...newWishlist.map((w) => tx.objectStore('wishlist').put(w)),
  ])
  await tx.done

  return { addedSeries: newSeries.length, addedVolumes: newVolumes.length, addedWishlist: newWishlist.length }
}
