import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

interface Props {
  onDetected: (isbn: string) => void
}

export default function BarcodeScanner({ onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const onDetectedRef = useRef(onDetected)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onDetectedRef.current = onDetected
  }, [onDetected])

  // Intentionally runs only once per mount: re-running this on every parent
  // re-render (e.g. AddScreen loading its series list) previously caused two
  // overlapping getUserMedia streams to race for the same <video> element,
  // leaving the preview black until the component was unmounted/remounted.
  useEffect(() => {
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13])
    const reader = new BrowserMultiFormatReader(hints)
    let cancelled = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        if (cancelled || !result) return
        const text = result.getText()
        if (/^\d{13}$/.test(text) && (text.startsWith('978') || text.startsWith('979'))) {
          onDetectedRef.current(text)
        }
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop()
        } else {
          controlsRef.current = controls
        }
      })
      .catch((err) => {
        setError('カメラを起動できませんでした。カメラの利用を許可してください。')
        console.error(err)
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="scanner">
      <video ref={videoRef} className="scanner__video" autoPlay muted playsInline />
      <div className="scanner__frame" />
      {error && <p className="scanner__error">{error}</p>}
      <p className="scanner__hint">ISBNバーコードを枠内に合わせてください</p>
    </div>
  )
}
