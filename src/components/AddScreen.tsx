import { useEffect, useState, type FormEvent } from 'react'
import BarcodeScanner from './BarcodeScanner'
import { lookupBookByIsbn } from '../api/bookLookup'
import { findSeriesByName, saveSeries, saveVolume, recordVolumeAdded, getAllSeries } from '../db'
import type { Series } from '../types'

interface Props {
  onSaved: () => void
  onCancel: () => void
  prefillSeriesName?: string
  prefillAuthor?: string
}

export default function AddScreen({ onSaved, onCancel, prefillSeriesName, prefillAuthor }: Props) {
  const [mode, setMode] = useState<'scan' | 'manual'>('scan')
  const [seriesList, setSeriesList] = useState<Series[]>([])
  const [seriesName, setSeriesName] = useState(prefillSeriesName ?? '')
  const [author, setAuthor] = useState(prefillAuthor ?? '')
  const [volumeNumber, setVolumeNumber] = useState('')
  const [isbn, setIsbn] = useState('')
  const [publisher, setPublisher] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [looking, setLooking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    getAllSeries().then(setSeriesList)
  }, [])

  async function handleDetected(detectedIsbn: string) {
    setIsbn(detectedIsbn)
    setLooking(true)
    setShowForm(true)
    const info = await lookupBookByIsbn(detectedIsbn)
    setLooking(false)
    if (info) {
      if (info.title) setSeriesName(info.title)
      if (info.author) setAuthor(info.author)
      if (info.publisher) setPublisher(info.publisher)
      if (info.coverImageUrl) setCoverImageUrl(info.coverImageUrl)
    } else {
      setMessage('書誌情報が見つかりませんでした。手動で入力してください。')
    }
  }

  async function handleManualLookup() {
    if (!isbn.trim()) return
    setLooking(true)
    const info = await lookupBookByIsbn(isbn)
    setLooking(false)
    if (info) {
      if (info.title) setSeriesName((prev) => prev || info.title || '')
      if (info.author) setAuthor((prev) => prev || info.author || '')
      if (info.publisher) setPublisher(info.publisher)
      if (info.coverImageUrl) setCoverImageUrl(info.coverImageUrl)
      setMessage(null)
    } else {
      setMessage('書誌情報が見つかりませんでした。')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const num = Number(volumeNumber)
    if (!seriesName.trim() || !num || num <= 0) {
      setMessage('シリーズ名と巻数を正しく入力してください。')
      return
    }
    setSaving(true)
    let series = await findSeriesByName(seriesName.trim())
    if (!series) {
      series = { id: crypto.randomUUID(), name: seriesName.trim(), author: author.trim(), createdAt: Date.now() }
      await saveSeries(series)
    } else if (!series.author && author.trim()) {
      series.author = author.trim()
      await saveSeries(series)
    }
    await saveVolume({
      id: crypto.randomUUID(),
      seriesId: series.id,
      volumeNumber: num,
      isbn: isbn.trim() || undefined,
      coverImageUrl: coverImageUrl || undefined,
      publisher: publisher || undefined,
      createdAt: Date.now(),
    })
    await recordVolumeAdded()
    setSaving(false)
    onSaved()
  }

  return (
    <div className="screen add-screen">
      <header className="screen__header">
        <button className="link-button" onClick={onCancel}>
          ← 戻る
        </button>
        <h1>巻を追加</h1>
      </header>

      <div className="tabbar">
        <button className={mode === 'scan' ? 'tab tab--active' : 'tab'} onClick={() => setMode('scan')}>
          スキャン
        </button>
        <button className={mode === 'manual' ? 'tab tab--active' : 'tab'} onClick={() => setMode('manual')}>
          手入力
        </button>
      </div>

      {mode === 'scan' && !showForm && <BarcodeScanner onDetected={handleDetected} />}

      {(showForm || mode === 'manual') && (
        <form className="add-form" onSubmit={handleSubmit}>
          {mode === 'manual' && (
            <div className="field-row">
              <label>ISBN</label>
              <div className="isbn-row">
                <input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="978XXXXXXXXXX" />
                <button type="button" className="button button--ghost" onClick={handleManualLookup} disabled={looking}>
                  {looking ? '取得中…' : '情報取得'}
                </button>
              </div>
            </div>
          )}

          {coverImageUrl && (
            <div className="cover-preview">
              <img src={coverImageUrl} alt="表紙プレビュー" />
            </div>
          )}
          {looking && mode === 'scan' && <p className="muted">書誌情報を取得中…</p>}

          <div className="field-row">
            <label>シリーズ名</label>
            <input
              value={seriesName}
              onChange={(e) => setSeriesName(e.target.value)}
              list="series-options"
              placeholder="例: ONE PIECE"
              required
            />
            <datalist id="series-options">
              {seriesList.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>

          <div className="field-row">
            <label>作者</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="例: 尾田栄一郎" />
          </div>

          <div className="field-row">
            <label>巻数</label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={volumeNumber}
              onChange={(e) => setVolumeNumber(e.target.value)}
              required
            />
          </div>

          {mode === 'scan' && (
            <div className="field-row">
              <label>ISBN</label>
              <input value={isbn} onChange={(e) => setIsbn(e.target.value)} />
            </div>
          )}

          {message && <p className="form-message">{message}</p>}

          <div className="form-actions">
            <button type="submit" className="button button--primary" disabled={saving}>
              {saving ? '保存中…' : '登録する'}
            </button>
            {mode === 'scan' && showForm && (
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setShowForm(false)
                  setSeriesName('')
                  setAuthor('')
                  setVolumeNumber('')
                  setIsbn('')
                  setCoverImageUrl('')
                  setPublisher('')
                  setMessage(null)
                }}
              >
                再スキャン
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
