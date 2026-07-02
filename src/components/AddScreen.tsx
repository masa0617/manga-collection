import { useEffect, useState, type FormEvent } from 'react'
import BarcodeScanner from './BarcodeScanner'
import { lookupBookByIsbn } from '../api/bookLookup'
import { parseVolumeFromTitle } from '../utils/titleParsing'
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
  const [magazine, setMagazine] = useState('')
  const [releaseDateISO, setReleaseDateISO] = useState<string | undefined>(undefined)
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
      if (info.title) {
        const parsed = parseVolumeFromTitle(info.title)
        setSeriesName(parsed.seriesName)
        const vol = info.volumeNumber ?? parsed.volumeNumber
        if (vol !== null && vol !== undefined) setVolumeNumber(String(vol))
      }
      if (info.author) setAuthor(info.author)
      if (info.publisher) setPublisher(info.publisher)
      if (info.magazine) setMagazine(info.magazine)
      if (info.releaseDateISO) setReleaseDateISO(info.releaseDateISO)
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
      if (info.title) {
        const parsed = parseVolumeFromTitle(info.title)
        setSeriesName((prev) => prev || parsed.seriesName)
        const vol = info.volumeNumber ?? parsed.volumeNumber
        if (vol !== null && vol !== undefined) {
          setVolumeNumber((prev) => prev || String(vol))
        }
      }
      if (info.author) setAuthor((prev) => prev || info.author || '')
      if (info.publisher) setPublisher(info.publisher)
      if (info.magazine) setMagazine(info.magazine)
      if (info.releaseDateISO) setReleaseDateISO(info.releaseDateISO)
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
      setMessage('タイトルと巻数を正しく入力してください。')
      return
    }
    setSaving(true)
    let series = await findSeriesByName(seriesName.trim())
    if (!series) {
      series = {
        id: crypto.randomUUID(),
        name: seriesName.trim(),
        author: author.trim(),
        createdAt: Date.now(),
        publisher: publisher || undefined,
        magazine: magazine || undefined,
      }
      await saveSeries(series)
    } else {
      let changed = false
      if (!series.author && author.trim()) {
        series.author = author.trim()
        changed = true
      }
      if (!series.publisher && publisher) {
        series.publisher = publisher
        changed = true
      }
      if (!series.magazine && magazine) {
        series.magazine = magazine
        changed = true
      }
      if (changed) await saveSeries(series)
    }
    await saveVolume({
      id: crypto.randomUUID(),
      seriesId: series.id,
      volumeNumber: num,
      isbn: isbn.trim() || undefined,
      coverImageUrl: coverImageUrl || undefined,
      publisher: publisher || undefined,
      releaseDateISO,
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
            <label>タイトル</label>
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
            <button type="submit" className="button button--primary" disabled={saving || looking}>
              {saving ? '保存中…' : looking ? '書誌情報取得中…' : '登録する'}
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
                  setMagazine('')
                  setReleaseDateISO(undefined)
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
