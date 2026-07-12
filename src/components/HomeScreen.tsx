import { useState } from 'react'
import type { Series, Volume } from '../types'
import SeriesCard from './SeriesCard'
import { compareByKana } from '../utils/titleParsing'

export type SortMode = 'kana' | 'recent'

interface Props {
  seriesList: Series[]
  volumesBySeriesId: Record<string, Volume[]>
  viewMode: 'grid' | 'list'
  onToggleViewMode: () => void
  sortMode: SortMode
  onToggleSortMode: () => void
  onSelectSeries: (id: string) => void
  onDeleteSeries: (id: string) => void
  onAdd: () => void
  onOpenSettings: () => void
}

function latestActivityAt(volumes: Volume[]): number {
  return volumes.reduce((max, v) => Math.max(max, v.createdAt), 0)
}

export default function HomeScreen({
  seriesList,
  volumesBySeriesId,
  viewMode,
  onToggleViewMode,
  sortMode,
  onToggleSortMode,
  onSelectSeries,
  onDeleteSeries,
  onAdd,
  onOpenSettings,
}: Props) {
  const [editMode, setEditMode] = useState(false)

  const sorted = [...seriesList].sort((a, b) => {
    if (sortMode === 'recent') {
      return latestActivityAt(volumesBySeriesId[b.id] ?? []) - latestActivityAt(volumesBySeriesId[a.id] ?? [])
    }
    return compareByKana(a, b)
  })

  return (
    <div className="screen home-screen">
      <header className="screen__header">
        <h1>マンガ棚</h1>
        <div className="header-actions">
          {!editMode && (
            <>
              <button className="link-button" onClick={onToggleSortMode}>
                {sortMode === 'kana' ? '最近追加した順' : '50音順'}
              </button>
              <button className="link-button" onClick={onToggleViewMode}>
                {viewMode === 'grid' ? 'リスト表示' : '表紙表示'}
              </button>
            </>
          )}
          {sorted.length > 0 && (
            <button className="link-button" onClick={() => setEditMode((m) => !m)}>
              {editMode ? '完了' : '編集'}
            </button>
          )}
          <button className="link-button" onClick={onOpenSettings} aria-label="設定">
            ⚙
          </button>
        </div>
      </header>

      {sorted.length === 0 ? (
        <p className="empty-state">まだシリーズが登録されていません。右下の＋から追加しましょう。</p>
      ) : viewMode === 'grid' ? (
        <div className="series-grid">
          {sorted.map((s) => (
            <SeriesCard
              key={s.id}
              series={s}
              volumes={volumesBySeriesId[s.id] ?? []}
              viewMode="grid"
              editMode={editMode}
              onClick={() => onSelectSeries(s.id)}
              onDelete={() => onDeleteSeries(s.id)}
            />
          ))}
        </div>
      ) : (
        <div className="series-list">
          {sorted.map((s) => (
            <SeriesCard
              key={s.id}
              series={s}
              volumes={volumesBySeriesId[s.id] ?? []}
              viewMode="list"
              editMode={editMode}
              onClick={() => onSelectSeries(s.id)}
              onDelete={() => onDeleteSeries(s.id)}
            />
          ))}
        </div>
      )}

      <button className="fab fab--tabbar" onClick={onAdd} aria-label="追加">
        ＋
      </button>
    </div>
  )
}
