import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Series, Volume, BackupMeta } from './types'

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
}

const DB_NAME = 'manga-collection'
const DB_VERSION = 1

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
  const normalized = name.trim().toLowerCase()
  return all.find((s) => s.name.trim().toLowerCase() === normalized)
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

export async function exportAllData(): Promise<{ series: Series[]; volumes: Volume[]; exportedAt: number }> {
  const [series, volumes] = await Promise.all([getAllSeries(), getAllVolumes()])
  return { series, volumes, exportedAt: Date.now() }
}
