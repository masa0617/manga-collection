import type { Series, Volume } from '../types'
import { getMissingVolumes } from '../utils/missingVolumes'

interface Props {
  series: Series
  volumes: Volume[]
  viewMode: 'grid' | 'list'
  onClick: () => void
}

export default function SeriesCard({ series, volumes, viewMode, onClick }: Props) {
  const sorted = [...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber)
  const representative = sorted[0]
  const hasMissing = getMissingVolumes(volumes.map((v) => v.volumeNumber)).length > 0

  if (viewMode === 'list') {
    return (
      <button className="series-row" onClick={onClick}>
        <span className="series-row__name">
          {hasMissing && <span className="warn-mark">⚠️</span>}
          {series.name}
        </span>
        <span className="series-row__count">{volumes.length}冊</span>
      </button>
    )
  }

  return (
    <button className="series-card" onClick={onClick}>
      <div className="series-card__cover">
        {representative?.coverImageUrl ? (
          <img src={representative.coverImageUrl} alt={series.name} loading="lazy" />
        ) : (
          <div className="series-card__placeholder">{series.name.slice(0, 1)}</div>
        )}
        {hasMissing && <span className="warn-badge">⚠️</span>}
      </div>
      <div className="series-card__title">{series.name}</div>
    </button>
  )
}
