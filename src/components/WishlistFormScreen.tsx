import { useState, type FormEvent } from 'react'
import type { WishlistItem } from '../types'
import CoverPicker from './CoverPicker'

interface Props {
  item: WishlistItem | null
  onSave: (item: WishlistItem) => void
  onCancel: () => void
  onConvertToSeries?: (item: WishlistItem) => void
}

export default function WishlistFormScreen({ item, onSave, onCancel, onConvertToSeries }: Props) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [author, setAuthor] = useState(item?.author ?? '')
  const [publisher, setPublisher] = useState(item?.publisher ?? '')
  const [magazine, setMagazine] = useState(item?.magazine ?? '')
  const [coverImageUrl, setCoverImageUrl] = useState(item?.coverImageUrl ?? '')
  const [message, setMessage] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setMessage('タイトルを入力してください。')
      return
    }
    onSave({
      id: item?.id ?? crypto.randomUUID(),
      title: title.trim(),
      author: author.trim() || undefined,
      publisher: publisher.trim() || undefined,
      magazine: magazine.trim() || undefined,
      coverImageUrl: coverImageUrl || undefined,
      createdAt: item?.createdAt ?? Date.now(),
    })
  }

  return (
    <div className="screen wishlist-form-screen">
      <header className="screen__header">
        <button className="link-button" onClick={onCancel}>
          ← 戻る
        </button>
        <h1>{item ? 'ほしい本を編集' : 'ほしい本を追加'}</h1>
      </header>

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

        {message && <p className="form-message">{message}</p>}

        <div className="form-actions">
          <button type="submit" className="button button--primary">
            保存する
          </button>
          <button type="button" className="button button--ghost" onClick={onCancel}>
            キャンセル
          </button>
        </div>

        {item && onConvertToSeries && (
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
        )}
      </form>
    </div>
  )
}
