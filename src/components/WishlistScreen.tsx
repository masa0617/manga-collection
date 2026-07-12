import { useState, type MouseEvent } from 'react'
import type { WishlistItem } from '../types'
import { compareByKana } from '../utils/titleParsing'

interface Props {
  items: WishlistItem[]
  onSelectItem: (id: string) => void
  onDeleteItem: (id: string) => void
  onAdd: () => void
}

// List-view only, by design - unlike the owned-collection tab, there's no
// grid/cover mode here (see task requirements).
export default function WishlistScreen({ items, onSelectItem, onDeleteItem, onAdd }: Props) {
  const [editMode, setEditMode] = useState(false)

  const sorted = [...items].sort((a, b) =>
    compareByKana({ name: a.title, kanaReading: a.kanaReading }, { name: b.title, kanaReading: b.kanaReading }),
  )

  function handleDelete(e: MouseEvent, item: WishlistItem) {
    e.stopPropagation()
    if (confirm(`「${item.title}」をほしいものリストから削除しますか？`)) onDeleteItem(item.id)
  }

  return (
    <div className="screen wishlist-screen">
      <header className="screen__header">
        <h1>ほしいものリスト</h1>
        <div className="header-actions">
          {sorted.length > 0 && (
            <button className="link-button" onClick={() => setEditMode((m) => !m)}>
              {editMode ? '完了' : '編集'}
            </button>
          )}
        </div>
      </header>

      {sorted.length === 0 ? (
        <p className="empty-state">ほしい漫画がまだ登録されていません。右下の＋から追加しましょう。</p>
      ) : (
        <div className="series-list">
          {sorted.map((item) => (
            <div
              className="series-row"
              key={item.id}
              onClick={editMode ? undefined : () => onSelectItem(item.id)}
            >
              <span className="wishlist-row__text">
                <span className="wishlist-row__title">{item.title}</span>
                {item.author && <span className="wishlist-row__author">{' '}{item.author}</span>}
              </span>
              {editMode && (
                <button className="series-row__delete" onClick={(e) => handleDelete(e, item)} aria-label="削除">
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <button className="fab fab--tabbar" onClick={onAdd} aria-label="追加">
        ＋
      </button>
    </div>
  )
}
