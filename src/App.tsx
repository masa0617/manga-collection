import { useEffect, useMemo, useRef, useState } from 'react'
import HomeScreen, { type SortMode } from './components/HomeScreen'
import SeriesDetailScreen from './components/SeriesDetailScreen'
import AddScreen from './components/AddScreen'
import BackupBanner from './components/BackupBanner'
import BottomTabBar, { type MainTab } from './components/BottomTabBar'
import WishlistScreen from './components/WishlistScreen'
import WishlistFormScreen from './components/WishlistFormScreen'
import SettingsScreen from './components/SettingsScreen'
import {
  getAllSeries,
  getAllVolumes,
  getBackupMeta,
  deleteVolume,
  deleteSeries,
  saveSeries,
  findSeriesByName,
  markBackedUp,
  exportAllData,
  getAllWishlistItems,
  saveWishlistItem,
  deleteWishlistItem,
  replaceAllData,
  mergeAllData,
  type MergeResult,
} from './db'
import { shouldPromptBackup, shareOrDownloadJson } from './utils/backup'
import { normalizeForMatch } from './utils/titleParsing'
import { runBackgroundVolumeCheck } from './utils/volumeCheckScheduler'
import { runBackgroundWishlistKanaCheck } from './utils/wishlistKanaScheduler'
import type { Series, Volume, BackupMeta, WishlistItem, BackupExport } from './types'

// While the app stays open, re-trigger a check cycle on this interval so a
// long-lived session keeps working through the backlog instead of only
// checking once at launch (each cycle itself only touches series overdue
// for a recheck - see volumeCheckScheduler).
const VOLUME_CHECK_RETRIGGER_MS = 10 * 60 * 1000

type View = 'home' | 'detail' | 'add' | 'wishlist' | 'wishlistForm' | 'settings'

interface HistoryState {
  view: View
  seriesId: string | null
  wishlistItemId: string | null
}

function readHistoryState(state: unknown): HistoryState {
  if (state && typeof state === 'object' && 'view' in state) {
    const s = state as Partial<HistoryState>
    if (
      s.view === 'detail' ||
      s.view === 'add' ||
      s.view === 'home' ||
      s.view === 'wishlist' ||
      s.view === 'wishlistForm' ||
      s.view === 'settings'
    ) {
      return { view: s.view, seriesId: s.seriesId ?? null, wishlistItemId: s.wishlistItemId ?? null }
    }
  }
  return { view: 'home', seriesId: null, wishlistItemId: null }
}

export default function App() {
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(null)
  const [view, setView] = useState<View>('home')
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [selectedWishlistItemId, setSelectedWishlistItemId] = useState<string | null>(null)
  const [homeViewMode, setHomeViewMode] = useState<'grid' | 'list'>('grid')
  const [sortMode, setSortMode] = useState<SortMode>('kana')
  const [loading, setLoading] = useState(true)
  // Scroll position the user was at on the home screen right before drilling
  // into a series, so "戻る"/back-gesture can restore it - captured at the
  // moment of navigating away (see navigate()) since the browser never
  // auto-scrolls on its own for this single-page app.
  const homeScrollRef = useRef(0)

  async function refresh() {
    const [s, v, meta, w] = await Promise.all([
      getAllSeries(),
      getAllVolumes(),
      getBackupMeta(),
      getAllWishlistItems(),
    ])
    setSeriesList(s)
    setVolumes(v)
    setBackupMeta(meta)
    setWishlistItems(w)
    setLoading(false)
    // iOS Safari has a known bug where a fixed-position element (the bottom
    // tab bar) doesn't repaint at its correct spot when page content shrinks
    // below the current scroll offset without an explicit scroll event -
    // e.g. deleting the last wishlist item collapses the list down to the
    // much shorter empty-state message while `view` itself doesn't change,
    // so the scrollTo-on-view-change effect below never fires. Nudging to
    // the same (browser-clamped) scroll position forces that repaint.
    requestAnimationFrame(() => window.scrollTo(0, window.scrollY))
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

  // Same idea as the volume check above, but for wishlist items' kana
  // reading (see wishlistKanaScheduler) - keeps the always-on 50-on sort in
  // WishlistScreen accurate as new items get added. Generation is a local,
  // deterministic computation (no network flakiness to retry on a timer -
  // see wishlistKanaScheduler), so a single pass on mount is enough to
  // backfill anything missing a reading (e.g. items restored from a backup).
  useEffect(() => {
    runBackgroundWishlistKanaCheck({
      onItemUpdated: (updated) => {
        setWishlistItems((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
      },
    })
  }, [])

  // Push a real history entry per screen so the browser's own back gesture
  // (iOS Safari's edge swipe, Android back button, desktop back button) can
  // navigate the app instead of only our in-app "戻る" buttons.
  useEffect(() => {
    if (!window.history.state) {
      window.history.replaceState({ view: 'home', seriesId: null, wishlistItemId: null } satisfies HistoryState, '')
    }
    function onPopState(e: PopStateEvent) {
      const state = readHistoryState(e.state)
      setView(state.view)
      setSelectedSeriesId(state.seriesId)
      setSelectedWishlistItemId(state.wishlistItemId)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function navigate(nextView: View, seriesId: string | null = null, wishlistItemId: string | null = null) {
    if (view === 'home' || view === 'wishlist') homeScrollRef.current = window.scrollY
    window.history.pushState({ view: nextView, seriesId, wishlistItemId } satisfies HistoryState, '')
    setView(nextView)
    setSelectedSeriesId(seriesId)
    setSelectedWishlistItemId(wishlistItemId)
  }

  function goBack() {
    window.history.back()
  }

  // Runs after every view switch (both in-app navigation and the browser's
  // own back gesture/button, which only updates state via popstate): reset to
  // the top for a freshly-opened screen, or restore the home screen to where
  // the user left off.
  useEffect(() => {
    window.scrollTo(0, view === 'home' ? homeScrollRef.current : 0)
  }, [view])

  const volumesBySeriesId = useMemo(() => {
    const map: Record<string, Volume[]> = {}
    for (const v of volumes) {
      if (!map[v.seriesId]) map[v.seriesId] = []
      map[v.seriesId].push(v)
    }
    return map
  }, [volumes])

  const selectedSeries = seriesList.find((s) => s.id === selectedSeriesId) ?? null
  const selectedWishlistItem = wishlistItems.find((w) => w.id === selectedWishlistItemId) ?? null

  async function handleBackup() {
    const data = await exportAllData()
    await shareOrDownloadJson(data, 'manga-backup')
    await markBackedUp()
    await refresh()
  }

  async function handleImportBackup(
    data: BackupExport,
    mode: 'merge' | 'replace',
  ): Promise<MergeResult | void> {
    const payload = { series: data.series, volumes: data.volumes, wishlist: data.wishlist }
    if (mode === 'replace') {
      await replaceAllData(payload)
      await refresh()
      return
    }
    const result = await mergeAllData(payload)
    await refresh()
    return result
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

  async function handleSaveWishlistItem(item: WishlistItem) {
    await saveWishlistItem(item)
    await refresh()
    // Adding a brand-new item (no selected id yet) still returns to the
    // list, same as before. Editing an existing item stays on the detail
    // screen, which switches itself back to display mode - see
    // WishlistFormScreen.
    if (!selectedWishlistItemId) goBack()
  }

  async function handleDeleteWishlistItem(id: string) {
    await deleteWishlistItem(id)
    await refresh()
  }

  // Moves a wishlist entry into the owned collection as a new (volume-less)
  // series - the user adds actual volumes afterward through the normal "+"
  // flow, since a wishlist entry never had ISBNs/volume numbers to begin
  // with. Reuses an existing series with the same name instead of creating a
  // duplicate, matching how AddScreen treats a fresh scan of a known series.
  async function handleConvertWishlistItemToSeries(item: WishlistItem) {
    let series = await findSeriesByName(item.title)
    if (!series) {
      series = {
        id: crypto.randomUUID(),
        name: item.title,
        author: item.author?.trim() ?? '',
        createdAt: Date.now(),
        publisher: item.publisher || undefined,
        magazine: item.magazine || undefined,
        customCoverUrl: item.coverImageUrl || undefined,
      }
      await saveSeries(series)
    }
    await deleteWishlistItem(item.id)
    await refresh()
    // Replaces the current (wishlistForm) history entry instead of pushing a
    // new one, so the back gesture from the series detail screen returns to
    // the wishlist list, not to a form for an entry that no longer exists.
    window.history.replaceState(
      { view: 'detail', seriesId: series.id, wishlistItemId: null } satisfies HistoryState,
      '',
    )
    setView('detail')
    setSelectedSeriesId(series.id)
    setSelectedWishlistItemId(null)
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

  async function handleUpdateCompleted(completed: boolean) {
    if (!selectedSeries) return
    await saveSeries({ ...selectedSeries, isCompleted: completed })
    await refresh()
  }

  // Lets a one-time correction (e.g. a badly-cased/formatted title the first
  // scanned volume happened to carry) stick going forward - resolveKnownSeries
  // (AddScreen) always prefers whatever's already saved as the series' name,
  // so renaming here is the only way to fix a name once it's locked in.
  // Returns false (without saving) when the new name collides with a
  // different already-registered series.
  async function handleUpdateName(name: string): Promise<boolean> {
    if (!selectedSeries) return false
    const trimmed = name.trim()
    if (!trimmed) return false
    const collision = seriesList.some(
      (s) => s.id !== selectedSeries.id && normalizeForMatch(s.name) === normalizeForMatch(trimmed),
    )
    if (collision) return false
    await saveSeries({ ...selectedSeries, name: trimmed })
    await refresh()
    return true
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
          onOpenSettings={() => navigate('settings')}
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
          onUpdateCompleted={handleUpdateCompleted}
          onUpdateName={handleUpdateName}
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

      {view === 'wishlist' && (
        <WishlistScreen
          items={wishlistItems}
          onSelectItem={(id) => navigate('wishlistForm', null, id)}
          onDeleteItem={handleDeleteWishlistItem}
          onAdd={() => navigate('wishlistForm', null, null)}
        />
      )}

      {view === 'wishlistForm' && (
        <WishlistFormScreen
          item={selectedWishlistItem}
          onCancel={goBack}
          onSave={handleSaveWishlistItem}
          onConvertToSeries={handleConvertWishlistItemToSeries}
        />
      )}

      {view === 'settings' && (
        <SettingsScreen
          onBack={goBack}
          onExport={handleBackup}
          onImport={handleImportBackup}
          lastBackupAt={backupMeta?.lastBackupAt ?? null}
        />
      )}

      {(view === 'home' || view === 'wishlist') && (
        <BottomTabBar active={view} onChange={(tab) => (tab !== view ? navigate(tab) : undefined)} />
      )}
    </div>
  )
}
