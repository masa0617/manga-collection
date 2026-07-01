import type { Series, Volume } from '../types'
import { getMissingVolumes } from '../utils/missingVolumes'

interface Props {
  series: Series
  volumes: Volume[]
  viewMode: 'grid' | 'list'
  onToggleViewMode: () => void
  onBack: () => void
  onAddVolume: () => void
  onDeleteVolume: (volumeId: string) => void
}

export default function SeriesDetailScreen({
  series,
  volumes,
  viewMode,
  onToggleViewMode,
  onBack,
  onAddVolume,
  onDeleteVolume,
}: Props) {
  const sorted = [...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber)
  const missing = getMissingVolumes(volumes.map((v) => v.volumeNumber))

  return (
    <div className="screen detail-screen">
      <header className="screen__header">
        <button className="link-button" onClick={onBack}>
          ← 戻る
        </button>
        <button className="link-button" onClick={onToggleViewMode}>
          {viewMode === 'grid' ? 'リスト表示' : '表紙表示'}
        </button>
      </header>

      <div className="detail-title">
        <h1>{series.name}</h1>
        {series.author && <p className="detail-author">{series.author}</p>}
      </div>

      {missing.length > 0 && (
        <div className="missing-banner">{missing.map((n) => `${n}巻`).join('、')}が未登録です</div>
      )}

      {sorted.length === 0 ? (
        <p className="empty-state">巻がまだ登録されていません。</p>
      ) : viewMode === 'grid' ? (
        <div className="volume-grid">
          {sorted.map((v) => (
            <div className="volume-card" key={v.id} onContextMenu={(e) => e.preventDefault()}>
              <button
                className="volume-card__delete"
                onClick={() => {
                  if (confirm(`${v.volumeNumber}巻を削除しますか？`)) onDeleteVolume(v.id)
                }}
                aria-label="削除"
              >
                ×
              </button>
              {v.coverImageUrl ? (
                <img src={v.coverImageUrl} alt={`${v.volumeNumber}巻`} loading="lazy" />
              ) : (
                <div className="volume-card__placeholder">{v.volumeNumber}</div>
              )}
              <div className="volume-card__label">{v.volumeNumber}巻</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="volume-list">
          {sorted.map((v) => (
            <div className="volume-row" key={v.id}>
              <span>{v.volumeNumber}巻</span>
              <button
                className="link-button link-button--danger"
                onClick={() => {
                  if (confirm(`${v.volumeNumber}巻を削除しますか？`)) onDeleteVolume(v.id)
                }}
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="fab" onClick={onAddVolume} aria-label="追加">
        ＋
      </button>
    </div>
  )
}
