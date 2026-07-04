// Percentage rect (relative to the displayed video box) that the on-screen
// guide frame occupies. Must stay in sync with .scanner__frame--wide in
// styles.css so the cropped region matches what the user actually sees
// inside the frame.
export const GUIDE_RECT = { top: 0.4, left: 0.06, width: 0.88, height: 0.2 }

const MIN_UPSCALED_WIDTH = 1400
const MAX_UPSCALE_FACTOR = 4

/**
 * Crops the video frame down to the on-screen guide-frame region and
 * upscales it for OCR. `video.clientWidth/clientHeight` is the CSS box the
 * guide frame's percentages are relative to; `video.videoWidth/videoHeight`
 * is the native stream resolution the canvas draws from. Because the video
 * uses object-fit: cover, the two differ in aspect ratio, so we replicate
 * the browser's "cover" math to map the visible guide rect back onto the
 * native frame instead of assuming a 1:1 mapping.
 */
export function captureGuideRegion(video: HTMLVideoElement): HTMLCanvasElement {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const cw = video.clientWidth
  const ch = video.clientHeight

  const coverScale = Math.max(cw / vw, ch / vh)
  const cropX = (vw * coverScale - cw) / 2
  const cropY = (vh * coverScale - ch) / 2

  const rectX = GUIDE_RECT.left * cw
  const rectY = GUIDE_RECT.top * ch
  const rectW = GUIDE_RECT.width * cw
  const rectH = GUIDE_RECT.height * ch

  const sx = (rectX + cropX) / coverScale
  const sy = (rectY + cropY) / coverScale
  const sw = rectW / coverScale
  const sh = rectH / coverScale

  const upscale = Math.min(MAX_UPSCALE_FACTOR, Math.max(1, MIN_UPSCALED_WIDTH / sw))

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw * upscale))
  canvas.height = Math.max(1, Math.round(sh * upscale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  return canvas
}

function otsuThreshold(gray: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0)
  for (let i = 0; i < gray.length; i++) histogram[gray[i]]++
  const total = gray.length

  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * histogram[t]

  let sumB = 0
  let weightB = 0
  let maxVariance = 0
  let threshold = 127
  for (let t = 0; t < 256; t++) {
    weightB += histogram[t]
    if (weightB === 0) continue
    const weightF = total - weightB
    if (weightF === 0) break
    sumB += t * histogram[t]
    const meanB = sumB / weightB
    const meanF = (sum - sumB) / weightF
    const variance = weightB * weightF * (meanB - meanF) * (meanB - meanF)
    if (variance > maxVariance) {
      maxVariance = variance
      threshold = t
    }
  }
  return threshold
}

/** Grayscale + Otsu binarization in place, to boost OCR contrast on small print. */
export function binarizeForOcr(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width, height } = canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  const pixelCount = width * height
  const gray = new Uint8ClampedArray(pixelCount)
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4
    gray[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]
  }
  const threshold = otsuThreshold(gray)
  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4
    const value = gray[i] > threshold ? 255 : 0
    data[o] = value
    data[o + 1] = value
    data[o + 2] = value
  }
  ctx.putImageData(imageData, 0, 0)
}
