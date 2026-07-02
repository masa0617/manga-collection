import { useRef, useState, type ChangeEvent } from 'react'

interface Props {
  onPick: (dataUrlOrUrl: string) => void
}

export default function CoverPicker({ onPick }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onPick(reader.result)
        setOpen(false)
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleUrlSubmit() {
    if (!url.trim()) return
    onPick(url.trim())
    setUrl('')
    setOpen(false)
  }

  if (!open) {
    return (
      <button className="link-button" onClick={() => setOpen(true)}>
        表紙を変更
      </button>
    )
  }

  return (
    <div className="cover-picker">
      <button className="button button--ghost" onClick={() => fileInputRef.current?.click()}>
        カメラロールから選択
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <div className="cover-picker__url-row">
        <input
          type="url"
          placeholder="画像のURLを貼り付け"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="button" className="button button--ghost" onClick={handleUrlSubmit}>
          設定
        </button>
      </div>
      <button className="link-button" onClick={() => setOpen(false)}>
        キャンセル
      </button>
    </div>
  )
}
