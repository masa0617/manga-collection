import type { MouseEvent } from 'react'
import type { Series, Volume } from '../types'
import { getMissingVolumes } from '../utils/missingVolumes'
import { getUpcomingRelease, hasNewRelease } from '../utils/newRelease'
import { getDisplayTotalVolumeCount } from '../utils/volumeEstimate'

interface Props {
  series: Series
  volumes: Volume[]
  viewMode: 'grid' | 'list'
  editMode: boolean
  onClick: () => void
  onDelete: () => void
}

export default function SeriesCard({ series, volumes, viewMode, editMode, onClick, onDelete }: Props) {
  const sorted = [...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber)
  const representativeCover = series.customCoverUrl || sorted[0]?.coverImageUrl
  const hasMissing = getMissingVolumes(volumes.map((v) => v.volumeNumber)).length > 0
  const isNewRelease = hasNewRelease(series, volumes)
  const upcomingRelease = getUpcomingRelease(series, volumes)
  const totalVolumeCount = getDisplayTotalVolumeCount(series, volumes)

  function handleDelete(e: MouseEvent) {
    e.stopPropagation()
    if (confirm(`「${series.name}」を削除しますか？（所持巻もすべて削除されます）`)) onDelete()
  }

  if (viewMode === 'list') {
    return (
      <div className="series-row" onClick={editMode ? undefined : onClick}>
        <span className="series-row__name">
          {hasMissing && <span className="warn-mark">⚠️</span>}
          {series.name}
        </span>
        <span className="series-row__actions">
          {editMode ? (
            <button className="series-row__delete" onClick={handleDelete} aria-label="削除">
              ×
            </button>
          ) : (
            <span className="series-row__count">
              {totalVolumeCount ? `全${totalVolumeCount}巻中${volumes.length}巻` : `${volumes.length}冊`}
            </span>
          )}
        </span>
      </div>
    )
  }

  return (
    <div className={editMode ? 'series-card series-card--jiggle' : 'series-card'}>
      {editMode && (
        <button className="series-card__delete" onClick={handleDelete} aria-label="削除">
          ×
        </button>
      )}
      <button className="series-card__body" onClick={editMode ? undefined : onClick}>
        <div className="series-card__cover">
          {representativeCover ? (
            <img src={representativeCover} alt={series.name} loading="lazy" />
          ) : (
            <div className="series-card__placeholder">{series.name.slice(0, 1)}</div>
          )}
          {series.isCompleted && !editMode && <span className="completed-badge">完結</span>}
          {isNewRelease && !editMode && <span className="new-badge">新刊</span>}
          {upcomingRelease && !editMode && (
            <span
              className={
                hasMissing
                  ? 'upcoming-badge upcoming-badge--corner upcoming-badge--below-warn'
                  : 'upcoming-badge upcoming-badge--corner'
              }
            >
              予約
            </span>
          )}
          {hasMissing && <span className="warn-badge">⚠️</span>}
        </div>
        <div className="series-card__title">{series.name}</div>
        <div className="series-card__count">
          {totalVolumeCount ? `全${totalVolumeCount}巻中${volumes.length}巻` : `${volumes.length}冊`}
        </div>
      </button>
    </div>
  )
}
