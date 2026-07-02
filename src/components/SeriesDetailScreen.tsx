import type { Series, Volume } from '../types'
import { getMissingVolumes } from '../utils/missingVolumes'
import { isRecentRelease } from '../utils/publishDate'
import CoverPicker from './CoverPicker'

interface Props {
  series: Series
  volumes: Volume[]
  onBack: () => void
  onAddVolume: () => void
  onDeleteVolume: (volumeId: string) => void
  onUpdateCover: (coverUrl: string) => void
}

export default function SeriesDetailScreen({
  series,
  volumes,
  onBack,
  onAddVolume,
  onDeleteVolume,
  onUpdateCover,
}: Props) {
  const sorted = [...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber)
  const missing = getMissingVolumes(volumes.map((v) => v.volumeNumber))
  const latestVolume = sorted[sorted.length - 1]
  const isNewRelease = latestVolume ? isRecentRelease(latestVolume.releaseDateISO) : false
  const representativeCover = series.customCoverUrl || sorted[0]?.coverImageUrl

  return (
    <div className="screen detail-screen">
      <header className="screen__header">
        <button className="link-button" onClick={onBack}>
          ← 戻る
        </button>
      </header>

      <div className="detail-info">
        <div className="detail-info__cover">
          {representativeCover ? (
            <img src={representativeCover} alt={series.name} />
          ) : (
            <div className="detail-info__placeholder">{series.name.slice(0, 1)}</div>
          )}
        </div>
        <div className="detail-info__text">
          <h1>
            {series.name}
            {isNewRelease && <span className="new-badge new-badge--inline">新刊</span>}
          </h1>
          {series.author && <p className="detail-info__field">{series.author}</p>}
          {series.publisher && <p className="detail-info__field detail-info__field--muted">{series.publisher}</p>}
          {series.magazine && <p className="detail-info__field detail-info__field--muted">{series.magazine}</p>}
          <CoverPicker onPick={onUpdateCover} />
        </div>
      </div>

      {missing.length > 0 && (
        <div className="missing-banner">{missing.map((n) => `${n}巻`).join('、')}が未登録です</div>
      )}

      {sorted.length === 0 ? (
        <p className="empty-state">巻がまだ登録されていません。</p>
      ) : (
        <div className="volume-list">
          {sorted.map((v) => (
            <div className="volume-row" key={v.id}>
              <span>
                {v.volumeNumber}巻
                {v.id === latestVolume?.id && isNewRelease && <span className="new-badge new-badge--inline">新刊</span>}
              </span>
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
