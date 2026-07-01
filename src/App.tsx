import { useEffect, useMemo, useState } from 'react'
import HomeScreen from './components/HomeScreen'
import SeriesDetailScreen from './components/SeriesDetailScreen'
import AddScreen from './components/AddScreen'
import BackupBanner from './components/BackupBanner'
import {
  getAllSeries,
  getAllVolumes,
  getBackupMeta,
  deleteVolume,
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
  const [detailViewMode, setDetailViewMode] = useState<'grid' | 'list'>('grid')
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
          onSelectSeries={(id) => {
            setSelectedSeriesId(id)
            setView('detail')
          }}
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
          viewMode={detailViewMode}
          onToggleViewMode={() => setDetailViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
          onBack={() => setView('home')}
          onAddVolume={() => setView('add')}
          onDeleteVolume={handleDeleteVolume}
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
