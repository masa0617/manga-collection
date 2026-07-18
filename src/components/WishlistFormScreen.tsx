import { useState, type FormEvent } from 'react'
import type { WishlistItem } from '../types'
import CoverPicker from './CoverPicker'
import { generateKanaReading } from '../utils/kanaGenerator'

interface Props {
  item: WishlistItem | null
  onSave: (item: WishlistItem) => void
  onCancel: () => void
  onConvertToSeries?: (item: WishlistItem) => void
}

// A brand-new item (item === null, reached via the "追加" flow) has nothing
// to display yet, so it always starts (and stays) in the editable form.
// An existing item (reached from the wishlist list) starts in a read-only
// display mode and only becomes editable via the "編集" button - see the
// task's display/edit mode split.
export default function WishlistFormScreen({ item, onSave, onCancel, onConvertToSeries }: Props) {
  const [editing, setEditing] = useState(item === null)
  const [title, setTitle] = useState(item?.title ?? '')
  const [author, setAuthor] = useState(item?.author ?? '')
  const [publisher, setPublisher] = useState(item?.publisher ?? '')
  const [magazine, setMagazine] = useState(item?.magazine ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(item?.coverImageUrl ?? '')
  const [kanaReading, setKanaReading] = useState(item?.kanaReading ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startEditing() {
    setTitle(item?.title ?? '')
    setAuthor(item?.author ?? '')
    setPublisher(item?.publisher ?? '')
    setMagazine(item?.magazine ?? '')
    setCoverImageUrl(item?.coverImageUrl ?? '')
    setKanaReading(item?.kanaReading ?? '')
    setMessage(null)
    setEditing(true)
  }

  // Left blank, the reading is (re)generated on-device from the title (see
  // kanaGenerator.ts) - typing a value here always wins over that and is
  // saved as a manual correction (kanaReadingIsManual) that future
  // generation passes never overwrite, for titles the generator gets wrong
  // (proper-noun readings, gikun wordplay, etc. - see kanaGenerator.test.ts).
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setMessage('タイトルを入力してください。')
      return
    }
    const trimmedTitle = title.trim()
    const trimmedKana = kanaReading.trim()
    const manual = trimmedKana !== ''
    setSaving(true)
    try {
      const finalKana = manual ? trimmedKana : ((await generateKanaReading(trimmedTitle)) ?? undefined)
      onSave({
        id: item?.id ?? crypto.randomUUID(),
        title: trimmedTitle,
        author: author.trim() || undefined,
        publisher: publisher.trim() || undefined,
        magazine: magazine.trim() || undefined,
        coverImageUrl: coverImageUrl || undefined,
        createdAt: item?.createdAt ?? Date.now(),
        kanaReading: finalKana,
        kanaReadingIsManual: manual,
      })
      if (item) setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  // Discards in-progress edits and returns to display mode for an existing
  // item; for a brand-new item (no display mode to return to) this is the
  // same "give up entirely" cancel it always was. Must restore the field
  // state back to the last-saved item, since the inputs are bound directly
  // to it - otherwise the discarded text/cover would keep showing in the
  // display view even though nothing was actually saved.
  function handleCancelEdit() {
    if (!item) {
      onCancel()
      return
    }
    setTitle(item.title)
    setAuthor(item.author ?? '')
    setPublisher(item.publisher ?? '')
    setMagazine(item.magazine ?? '')
    setCoverImageUrl(item.coverImageUrl ?? '')
    setKanaReading(item.kanaReading ?? '')
    setMessage(null)
    setEditing(false)
  }

  const convertButton = item && onConvertToSeries && (
    <button
      type="button"
      className="link-button wishlist-form__convert"
      onClick={() => {
        if (confirm(`「${item.title}」を購入済みとして蔵書に登録しますか？（ほしいものリストからは削除されます）`)) {
          onConvertToSeries(item)
        }
      }}
    >
      購入済みにして蔵書へ登録
    </button>
  )

  return (
    <div className="screen wishlist-form-screen">
      <header className="screen__header">
        <button className="link-button" onClick={onCancel}>
          ← 戻る
        </button>
        <h1>{item ? (editing ? 'ほしい本を編集' : 'ほしい本の詳細') : 'ほしい本を追加'}</h1>
      </header>

      {editing ? (
        <form className="add-form" onSubmit={handleSubmit}>
          {coverImageUrl && (
            <div className="cover-preview">
              <img src={coverImageUrl} alt="表紙プレビュー" />
            </div>
          )}
          <CoverPicker onPick={setCoverImageUrl} />

          <div className="field-row">
            <label>タイトル</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: ONE PIECE" required />
          </div>

          <div className="field-row">
            <label>著者</label>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="例: 尾田栄一郎" />
          </div>

          <div className="field-row">
            <label>出版社</label>
            <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="例: 集英社" />
          </div>

          <div className="field-row">
            <label>掲載誌</label>
            <input value={magazine} onChange={(e) => setMagazine(e.target.value)} placeholder="例: 週刊少年ジャンプ" />
          </div>

          <div className="field-row">
            <label>読み仮名</label>
            <input
              value={kanaReading}
              onChange={(e) => setKanaReading(e.target.value)}
              placeholder="空欄なら自動判定（例: クサナギセンセイワタメサレテイル）"
            />
          </div>

          {message && <p className="form-message">{message}</p>}

          <div className="form-actions">
            <button type="submit" className="button button--primary" disabled={saving}>
              保存する
            </button>
            <button type="button" className="button button--ghost" onClick={handleCancelEdit}>
              キャンセル
            </button>
          </div>
        </form>
      ) : (
        <div className="wishlist-detail-view">
          <div className="wishlist-detail-view__cover">
            {coverImageUrl ? (
              <img src={coverImageUrl} alt={title} />
            ) : (
              <div className="detail-info__placeholder">{title.slice(0, 1)}</div>
            )}
          </div>
          <div className="wishlist-detail-view__text">
            <h1>{title}</h1>
            {author && <p className="detail-info__field">{author}</p>}
            {publisher && <p className="detail-info__field detail-info__field--muted">{publisher}</p>}
            {magazine && <p className="detail-info__field detail-info__field--muted">{magazine}</p>}
          </div>

          <div className="form-actions">
            <button type="button" className="button button--primary" onClick={startEditing}>
              編集
            </button>
          </div>

          {convertButton}
        </div>
      )}
    </div>
  )
}
