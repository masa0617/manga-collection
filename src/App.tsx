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
import { runBackgroundVolumeCheck } from './utils/volumeCheckScheduler'
import type { Series, Volume, BackupMeta } from './types'

// While the app stays open, re-trigger a check cycle on this interval so a
// long-lived session keeps working through the backlog instead of only
// checking once at launch (each cycle itself only touches series overdue
// for a recheck - see volumeCheckScheduler).
const VOLUME_CHECK_RETRIGGER_MS = 10 * 60 * 1000

type View = 'home' | 'detail' | 'add'

interface HistoryState {
  view: View
  seriesId: string | null
}

function readHistoryState(state: unknown): HistoryState {
  if (state && typeof state === 'object' && 'view' in state) {
    const s = state as Partial<HistoryState>
    if (s.view === 'detail' || s.view === 'add' || s.view === 'home') {
      return { view: s.view, seriesId: s.seriesId ?? null }
    }
  }
  return { view: 'home', seriesId: null }
}

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

  // Best-effort background refresh of new-release data: doesn't block the
  // initial render (which always shows whatever was last saved locally), and
  // a failed check simply leaves a series' data as-is rather than surfacing
  // an error anywhere in the UI.
  useEffect(() => {
    function checkNow() {
      runBackgroundVolumeCheck({
        onSeriesUpdated: (updated) => {
          setSeriesList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        },
      })
    }
    checkNow()
    const interval = setInterval(checkNow, VOLUME_CHECK_RETRIGGER_MS)
    return () => clearInterval(interval)
  }, [])

  // Push a real history entry per screen so the browser's own back gesture
  // (iOS Safari's edge swipe, Android back button, desktop back button) can
  // navigate the app instead of only our in-app "戻る" buttons.
  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ view: 'home', seriesId: null } satisfies HistoryState, '')
    }
    function onPopState(e: PopStateEvent) {
      const state = readHistoryState(e.state)
      setView(state.view)
      setSelectedSeriesId(state.seriesId)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextView: View, seriesId: string | null) {
    window.history.pushState({ view: nextView, seriesId } satisfies HistoryState, '')
    setView(nextView)
    setSelectedSeriesId(seriesId)
  }

  function goBack() {
    window.history.back()
  }

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
    if (view === 'detail' && selectedSeriesId === seriesId) {
      goBack()
    }
    await refresh()
  }

  async function handleUpdateCover(coverUrl: string) {
    if (!selectedSeries) return
    await saveSeries({ ...selectedSeries, customCoverUrl: coverUrl })
    await refresh()
  }

  async function handleUpdateTotalVolumeCount(count: number | undefined) {
    if (!selectedSeries) return
    await saveSeries({ ...selectedSeries, manualTotalVolumeCount: count })
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
          onSelectSeries={(id) => navigate('detail', id)}
          onDeleteSeries={handleDeleteSeries}
          onAdd={() => navigate('add', null)}
        />
      )}

      {view === 'detail' && selectedSeries && (
        <SeriesDetailScreen
          series={selectedSeries}
          volumes={volumesBySeriesId[selectedSeries.id] ?? []}
          onBack={goBack}
          onAddVolume={() => navigate('add', selectedSeries.id)}
          onDeleteVolume={handleDeleteVolume}
          onUpdateCover={handleUpdateCover}
          onUpdateTotalVolumeCount={handleUpdateTotalVolumeCount}
        />
      )}

      {view === 'add' && (
        <AddScreen
          prefillSeriesName={selectedSeries?.name}
          prefillAuthor={selectedSeries?.author}
          onCancel={goBack}
          onSaved={async () => {
            await refresh()
            goBack()
          }}
        />
      )}
    </div>
  )
}
