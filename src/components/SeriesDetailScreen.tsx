import { useState } from 'react'
import type { Series, Volume } from '../types'
import { getMissingVolumes } from '../utils/missingVolumes'
import { getUpcomingRelease, hasRecentNewRelease } from '../utils/newRelease'
import { formatJapaneseDate } from '../utils/publishDate'
import { getDisplayTotalVolumeCount, getOwnedMaxVolume } from '../utils/volumeEstimate'
import CoverPicker from './CoverPicker'

interface Props {
  series: Series
  volumes: Volume[]
  onBack: () => void
  onAddVolume: () => void
  onDeleteVolume: (volumeId: string) => void
  onUpdateCover: (coverUrl: string) => void
  onUpdateTotalVolumeCount: (count: number | undefined) => void
  onUpdateName: (name: string) => Promise<boolean>
}

export default function SeriesDetailScreen({
  series,
  volumes,
  onBack,
  onAddVolume,
  onDeleteVolume,
  onUpdateCover,
  onUpdateTotalVolumeCount,
  onUpdateName,
}: Props) {
  const [editingTotal, setEditingTotal] = useState(false)
  const [totalInput, setTotalInput] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)

  const sorted = [...volumes].sort((a, b) => a.volumeNumber - b.volumeNumber)
  const missing = getMissingVolumes(volumes.map((v) => v.volumeNumber))
  const latestVolume = sorted[sorted.length - 1]
  const isNewRelease = hasRecentNewRelease(series, volumes)
  const upcomingRelease = getUpcomingRelease(series, volumes)
  const representativeCover = series.customCoverUrl || sorted[0]?.coverImageUrl
  const totalVolumeCount = getDisplayTotalVolumeCount(series, volumes)

  function startEditingTotal() {
    setTotalInput(totalVolumeCount ? String(totalVolumeCount) : '')
    setEditingTotal(true)
  }

  function startEditingName() {
    setNameInput(series.name)
    setNameError(null)
    setEditingName(true)
  }

  async function saveName() {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    if (trimmed === series.name) {
      setEditingName(false)
      return
    }
    const ok = await onUpdateName(trimmed)
    if (ok) {
      setEditingName(false)
    } else {
      setNameError('同じ名前のシリーズが既に存在します。')
    }
  }

  function saveTotal() {
    const trimmed = totalInput.trim()
    if (!trimmed) {
      onUpdateTotalVolumeCount(undefined)
      setEditingTotal(false)
      return
    }
    const num = Number(trimmed)
    if (Number.isInteger(num) && num > 0) {
      // Never lets a manual total go below what's actually owned - see
      // getDisplayTotalVolumeCount's clamp for why this contradiction must
      // never even be saveable, not just corrected later in the background.
      onUpdateTotalVolumeCount(Math.max(num, getOwnedMaxVolume(volumes)))
      setEditingTotal(false)
    }
  }

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
          {editingName ? (
            <div className="series-name-row">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="シリーズ名"
                className="series-name-input"
              />
              <button type="button" className="link-button" onClick={saveName}>
                保存
              </button>
              <button type="button" className="link-button" onClick={() => setEditingName(false)}>
                キャンセル
              </button>
              {nameError && <p className="form-message">{nameError}</p>}
            </div>
          ) : (
            <h1>
              {series.name}
              {isNewRelease && <span className="new-badge new-badge--inline">新刊</span>}
              <button type="button" className="link-button link-button--inline" onClick={startEditingName}>
                編集
              </button>
            </h1>
          )}
          {series.author && <p className="detail-info__field">{series.author}</p>}
          {series.publisher && <p className="detail-info__field detail-info__field--muted">{series.publisher}</p>}
          {series.magazine && <p className="detail-info__field detail-info__field--muted">{series.magazine}</p>}

          <div className="total-volume-row">
            {editingTotal ? (
              <>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  placeholder="全巻数"
                  className="total-volume-input"
                />
                <button type="button" className="link-button" onClick={saveTotal}>
                  保存
                </button>
                <button type="button" className="link-button" onClick={() => setEditingTotal(false)}>
                  キャンセル
                </button>
              </>
            ) : (
              <>
                <span className="detail-info__field detail-info__field--muted">
                  {totalVolumeCount ? `全${totalVolumeCount}巻中${volumes.length}巻(所持)` : `${volumes.length}巻(所持)`}
                </span>
                <button type="button" className="link-button" onClick={startEditingTotal}>
                  全巻数を編集
                </button>
              </>
            )}
          </div>

          {!isNewRelease && upcomingRelease && (
            <p className="detail-info__field upcoming-note">
              第{upcomingRelease.volumeNumber}巻 発売予定日: {formatJapaneseDate(upcomingRelease.dateISO)}
            </p>
          )}

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
