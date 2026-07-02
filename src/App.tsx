import { useEffect, useMemo, useState } from 'react'
import HomeScreen, { type SortMode } from './components/HomeScreen'
import SeriesDetailScreen from './components/SeriesDetailScreen'
import AddScreen from './components/AddScreen'
import BackupBanner from './components/BackupBanner'
import {
  getAllSeries,
  getAllVolumes,
  getBackupMeta,
  deleteVolume,
  deleteSeries,
  saveSeries,
  markBackedUp,
  exportAllData,
} from './db'
import { shouldPromptBackup, shareOrDownloadJson } from './utils/backup'
import type { Series, Volume, BackupMeta } from './types'

type View = 'home' | 'detail' | 'add'

export default function App() {
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(null)
  const [view, setView] = useState<View>('home')
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [homeViewMode, setHomeViewMode] = useState<'grid' | 'list'>('grid')
  const [sortMode, setSortMode] = useState<SortMode>('kana')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const [s, v, meta] = await Promise.all([getAllSeries(), getAllVolumes(), getBackupMeta()])
    setSeriesList(s)
    setVolumes(v)
    setBackupMeta(meta)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const volumesBySeriesId = useMemo(() => {
    const map: Record<string, Volume[]> = {}
    for (const v of volumes) {
      if (!map[v.seriesId]) map[v.seriesId] = []
      map[v.seriesId].push(v)
    }
    return map
  }, [volumes])

  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId) ?? null

  async function handleBackup() {
    const data = await exportAllData()
    await shareOrDownloadJson(data, 'manga-backup')
    await markBackedUp()
    await refresh()
  }

  async function handleDeleteVolume(volumeId: string) {
    await deleteVolume(volumeId)
    await refresh()
  }

  async function handleDeleteSeries(seriesId: string) {
    await deleteSeries(seriesId)
    if (selectedSeriesId === seriesId) {
      setSelectedSeriesId(null)
      setView('home')
    }
    await refresh()
  }

  async function handleUpdateCover(coverUrl: string) {
    if (!selectedSeries) return
    await saveSeries({ ...selectedSeries, customCoverUrl: coverUrl })
    await refresh()
  }

  if (loading) {
    return <div className="loading-screen">読み込み中…</div>
  }

  return (
    <div className="app">
      {backupMeta && shouldPromptBackup(backupMeta) && <BackupBanner onClick={handleBackup} />}

      {view === 'home' && (
        <HomeScreen
          seriesList={seriesList}
          volumesBySeriesId={volumesBySeriesId}
          viewMode={homeViewMode}
          onToggleViewMode={() => setHomeViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
          sortMode={sortMode}
          onToggleSortMode={() => setSortMode((m) => (m === 'kana' ? 'recent' : 'kana'))}
          onSelectSeries={(id) => {
            setSelectedSeriesId(id)
            setView('detail')
          }}
          onDeleteSeries={handleDeleteSeries}
          onAdd={() => {
            setSelectedSeriesId(null)
            setView('add')
          }}
        />
      )}

      {view === 'detail' && selectedSeries && (
        <SeriesDetailScreen
          series={selectedSeries}
          volumes={volumesBySeriesId[selectedSeries.id] ?? []}
          onBack={() => setView('home')}
          onAddVolume={() => setView('add')}
          onDeleteVolume={handleDeleteVolume}
          onUpdateCover={handleUpdateCover}
        />
      )}

      {view === 'add' && (
        <AddScreen
          prefillSeriesName={selectedSeries?.name}
          prefillAuthor={selectedSeries?.author}
          onCancel={() => setView(selectedSeries ? 'detail' : 'home')}
          onSaved={async () => {
            await refresh()
            setView(selectedSeries ? 'detail' : 'home')
          }}
        />
      )}
    </div>
  )
}
