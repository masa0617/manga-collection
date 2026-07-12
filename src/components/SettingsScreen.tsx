import { useRef, useState, type ChangeEvent } from 'react'
import type { BackupExport } from '../types'
import type { MergeResult } from '../db'
import { parseBackupFile } from '../utils/backupImport'

type RestoreMode = 'merge' | 'replace'

interface Props {
  onBack: () => void
  onExport: () => void
  onImport: (data: BackupExport, mode: RestoreMode) => Promise<MergeResult | void>
  lastBackupAt: number | null
}

export default function SettingsScreen({ onBack, onExport, onImport, lastBackupAt }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<RestoreMode>('merge')
  const [message, setMessage] = useState<string | null>(null)
  const [messageIsError, setMessageIsError] = useState(false)
  const [busy, setBusy] = useState(false)

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      const result = parseBackupFile(reader.result)
      if (!result.ok) {
        setMessageIsError(true)
        setMessage(result.error)
        return
      }

      const counts = `シリーズ${result.data.series.length}件・巻${result.data.volumes.length}件・ほしいものリスト${result.data.wishlist.length}件`
      const confirmText =
        mode === 'replace'
          ? `既存の蔵書・ほしいものリストのデータをすべて削除し、このバックアップの内容（${counts}）に完全に置き換えます。この操作は取り消せません。よろしいですか？`
          : `このバックアップの内容（${counts}）のうち、手元にまだ無いものだけを追加します。既存のデータは変更されません。よろしいですか？`
      if (!confirm(confirmText)) return

      setBusy(true)
      setMessage(null)
      ;(async () => {
        try {
          const restored = await onImport(result.data, mode)
          if (mode === 'merge' && restored) {
            setMessage(
              `復元が完了しました。追加: シリーズ${restored.addedSeries}件・巻${restored.addedVolumes}件・ほしいものリスト${restored.addedWishlist}件`,
            )
          } else {
            setMessage('復元が完了しました。')
          }
          setMessageIsError(false)
        } catch (err) {
          console.error(err)
          setMessageIsError(true)
          setMessage('復元中にエラーが発生しました。データは変更されていない可能性があります。')
        } finally {
          setBusy(false)
        }
      })()
    }
    reader.onerror = () => {
      setMessageIsError(true)
      setMessage('ファイルの読み込みに失敗しました。')
    }
    reader.readAsText(file)
  }

  return (
    <div className="screen settings-screen">
      <header className="screen__header">
        <button className="link-button" onClick={onBack}>
          ← 戻る
        </button>
        <h1>設定</h1>
      </header>

      <section className="settings-section">
        <h2 className="settings-section__title">バックアップ</h2>
        <p className="settings-section__desc">
          {lastBackupAt
            ? `最終バックアップ: ${new Date(lastBackupAt).toLocaleString('ja-JP')}`
            : 'まだバックアップを書き出していません。'}
        </p>
        <button type="button" className="button button--primary" onClick={onExport}>
          バックアップを書き出す
        </button>
      </section>

      <section className="settings-section">
        <h2 className="settings-section__title">バックアップから復元</h2>
        <p className="settings-section__desc">
          書き出したJSONファイルを選択して、蔵書とほしいものリストのデータを復元します。
        </p>

        <div className="settings-radio-row">
          <label className="settings-radio">
            <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
            マージ（手元に無いものだけ追加）
          </label>
          <label className="settings-radio">
            <input
              type="radio"
              name="restore-mode"
              checked={mode === 'replace'}
              onChange={() => setMode('replace')}
            />
            全置き換え（既存データを削除して復元）
          </label>
        </div>

        <button
          type="button"
          className="button button--ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          {busy ? '復元中…' : 'JSONファイルを選択して復元'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {message && <p className={messageIsError ? 'form-message' : 'settings-message--success'}>{message}</p>}
      </section>
    </div>
  )
}
