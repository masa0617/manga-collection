import type { Series, Volume } from '../types'
import SeriesCard from './SeriesCard'

interface Props {
  seriesList: Series[]
  volumesBySeriesId: Record<string, Volume[]>
  viewMode: 'grid' | 'list'
  onToggleViewMode: () => void
  onSelectSeries: (id: string) => void
  onAdd: () => void
}

export default function HomeScreen({
  seriesList,
  volumesBySeriesId,
  viewMode,
  onToggleViewMode,
  onSelectSeries,
  onAdd,
}: Props) {
  const sorted = [...seriesList].sort((a, b) => a.name.localeCompare(b.name, 'ja'))

  return (
    <div className="screen home-screen">
      <header className="screen__header">
        <h1>マンガ棚</h1>
        <button className="link-button" onClick={onToggleViewMode}>
          {viewMode === 'grid' ? 'リスト表示' : '表紙表示'}
        </button>
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
              onClick={() => onSelectSeries(s.id)}
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
              onClick={() => onSelectSeries(s.id)}
            />
          ))}
        </div>
      )}

      <button className="fab" onClick={onAdd} aria-label="追加">
        ＋
      </button>
    </div>
  )
}
