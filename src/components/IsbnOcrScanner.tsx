import { useEffect, useRef, useState } from 'react'
import * as Tesseract from 'tesseract.js'
import { extractIsbnFromText } from '../utils/isbnOcr'

interface Props {
  onDetected: (isbn: string) => void
  onCancel: () => void
}

export default function IsbnOcrScanner({ onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const workerRef = useRef<Tesseract.Worker | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      })
      .catch((err) => {
        setError('カメラを起動できませんでした。カメラの利用を許可してください。')
        console.error(err)
      })

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  async function getWorker() {
    if (!workerRef.current) {
      const worker = await Tesseract.createWorker('eng')
      await worker.setParameters({
        tessedit_char_whitelist: 'ISBNisbn0123456789-: ',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
      })
      workerRef.current = worker
    }
    return workerRef.current
  }

  async function handleCapture() {
    const video = videoRef.current
    if (!video || recognizing || !video.videoWidth) return
    setNotice(null)
    setError(null)
    setRecognizing(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas 2d context unavailable')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const worker = await getWorker()
      const { data } = await worker.recognize(canvas)
      const isbn = extractIsbnFromText(data.text)
      if (isbn) {
        onDetected(isbn)
      } else {
        setNotice('数字を認識できませんでした。ピントを合わせて枠内に数字を収め、もう一度撮影するか手入力してください。')
      }
    } catch (err) {
      setError('文字認識に失敗しました。もう一度お試しください。')
      console.error(err)
    } finally {
      setRecognizing(false)
    }
  }

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner__video" autoPlay muted playsInline />
      <div className="scanner__frame scanner__frame--wide" />
      {error && <p className="scanner__error">{error}</p>}
      {!error && <p className="scanner__hint">「ISBN978…」の数字部分を枠内に合わせて撮影してください</p>}

      <div className="ocr-controls">
        <button type="button" className="button button--ghost" onClick={onCancel} disabled={recognizing}>
          バーコードに戻る
        </button>
        <button type="button" className="button button--primary" onClick={handleCapture} disabled={recognizing || !!error}>
          {recognizing ? '認識中…' : '撮影して読み取る'}
        </button>
      </div>

      {notice && <p className="form-message">{notice}</p>}
    </div>
  )
}
