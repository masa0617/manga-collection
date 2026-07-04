import { useEffect, useRef, useState } from 'react'
import * as Tesseract from 'tesseract.js'
import { extractIsbnFromText } from '../utils/isbnOcr'
import { binarizeForOcr, captureGuideRegion } from '../utils/ocrImage'

interface Props {
  onDetected: (isbn: string) => void
  onCancel: () => void
}

const RETRY_DELAY_MS = 900
const HINT_AFTER_ATTEMPTS = 6

// Non-standard but supported on Android Chrome; not present in the DOM lib types,
// so capabilities/settings are cast to this shape at each call site instead of
// widening MediaStreamTrack's own method signatures (which confuses overload
// resolution when intersected directly on the ref type).
type ZoomRange = { min: number; max: number; step?: number }
function getZoomCapabilities(track: MediaStreamTrack): ZoomRange | undefined {
  return (track.getCapabilities?.() as (MediaTrackCapabilities & { zoom?: ZoomRange }) | undefined)?.zoom
}
function getZoomSetting(track: MediaStreamTrack): number | undefined {
  return (track.getSettings?.() as (MediaTrackSettings & { zoom?: number }) | undefined)?.zoom
}

export default function IsbnOcrScanner({ onDetected, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const workerRef = useRef<Tesseract.Worker | null>(null)
  const stoppedRef = useRef(false)
  const busyRef = useRef(false)
  const loopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptsRef = useRef(0)
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null)
  const onDetectedRef = useRef(onDetected)

  const [error, setError] = useState<string | null>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

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

  function scheduleNextAttempt(delay: number) {
    if (stoppedRef.current) return
    loopTimerRef.current = setTimeout(runAttempt, delay)
  }

  async function runAttempt() {
    if (stoppedRef.current || busyRef.current) return
    const video = videoRef.current
    if (!video || !video.videoWidth) {
      scheduleNextAttempt(300)
      return
    }
    busyRef.current = true
    setRecognizing(true)
    try {
      const canvas = captureGuideRegion(video)
      binarizeForOcr(canvas)
      const worker = await getWorker()
      const { data } = await worker.recognize(canvas)
      const isbn = extractIsbnFromText(data.text)
      if (isbn && !stoppedRef.current) {
        stoppedRef.current = true
        onDetectedRef.current(isbn)
        return
      }
    } catch (err) {
      console.error(err)
    }
    attemptsRef.current += 1
    if (attemptsRef.current === HINT_AFTER_ATTEMPTS) {
      setNotice('明るい場所で、数字をできるだけ大きく枠内に収めてみてください。')
    }
    busyRef.current = false
    setRecognizing(false)
    scheduleNextAttempt(RETRY_DELAY_MS)
  }

  function handleManualRetry() {
    if (loopTimerRef.current) clearTimeout(loopTimerRef.current)
    runAttempt()
  }

  useEffect(() => {
    stoppedRef.current = false

    navigator.mediaDevices
      .getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 3840 },
          height: { ideal: 2160 },
        },
      })
      .then((stream) => {
        if (stoppedRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        trackRef.current = stream.getVideoTracks()[0] ?? null
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
        scheduleNextAttempt(500)
      })
      .catch((err) => {
        setError('カメラを起動できませんでした。カメラの利用を許可してください。')
        console.error(err)
      })

    return () => {
      stoppedRef.current = true
      if (loopTimerRef.current) clearTimeout(loopTimerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      trackRef.current = null
      workerRef.current?.terminate()
      workerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function touchDistance(touches: React.TouchList): number {
    const a = touches[0]
    const b = touches[1]
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  }

  function handleTouchStart(e: React.TouchEvent<HTMLVideoElement>) {
    const track = trackRef.current
    const zoom = track && getZoomCapabilities(track)
    if (e.touches.length !== 2 || !track || !zoom) return
    pinchRef.current = {
      startDist: touchDistance(e.touches),
      startZoom: getZoomSetting(track) ?? zoom.min,
    }
  }

  function handleTouchMove(e: React.TouchEvent<HTMLVideoElement>) {
    const track = trackRef.current
    const zoom = track && getZoomCapabilities(track)
    if (e.touches.length !== 2 || !pinchRef.current || !track || !zoom) return
    const ratio = touchDistance(e.touches) / pinchRef.current.startDist
    const nextZoom = Math.min(zoom.max, Math.max(zoom.min, pinchRef.current.startZoom * ratio))
    track.applyConstraints({ advanced: [{ zoom: nextZoom } as MediaTrackConstraintSet] }).catch(() => {})
  }

  function handleTouchEnd() {
    pinchRef.current = null
  }

  return (
    <div className="ocr-scanner">
      <div className="scanner">
        <video
          ref={videoRef}
          className="scanner__video"
          autoPlay
          muted
          playsInline
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <div className="scanner__frame scanner__frame--wide" />
        {error && <p className="scanner__error">{error}</p>}
      </div>

      {!error && <p className="scanner__hint-static">「ISBN978…」の数字部分を枠内いっぱいに合わせてください（自動で読み取ります）</p>}

      <div className="ocr-controls">
        <button type="button" className="button button--ghost" onClick={onCancel}>
          バーコードに戻る
        </button>
        <button type="button" className="button button--primary" onClick={handleManualRetry} disabled={!!error}>
          {recognizing ? '認識中…' : '今すぐ試す'}
        </button>
      </div>

      {notice && <p className="form-message">{notice}</p>}
    </div>
  )
}
