import type { BookInfo } from '../types'
import { extractVolumeNumberFromLabel } from '../utils/titleParsing'

async function fetchWithTimeout(url: string, ms = 6000): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return res
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function toHttps(url: string | undefined): string | undefined {
  if (!url) return undefined
  // Google Books thumbnails are sometimes served as http://, which browsers
  // block/strip as mixed content on an https page (like the Vercel deploy).
  return url.replace(/^http:\/\//, 'https://')
}

async function lookupOpenBD(isbn: string): Promise<BookInfo | null> {
  const res = await fetchWithTimeout(`https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(isbn)}`)
  if (!res) return null
  const data = await res.json().catch(() => null)
  const record = Array.isArray(data) ? data[0] : null
  if (!record) return null
  const summary = record.summary ?? {}
  const info: BookInfo = {
    title: summary.title || undefined,
    author: summary.author || undefined,
    publisher: summary.publisher || undefined,
    coverImageUrl: toHttps(summary.cover || undefined),
  }
  return info.title || info.author || info.coverImageUrl ? info : null
}

// National Diet Library Search: an authoritative Japanese source that covers
// many manga/light-novel volumes openBD doesn't carry, and always returns the
// Japanese-language title/creator (unlike Google Books, which sometimes surfaces
// an English-market edition's metadata for the same ISBN).
async function lookupNdl(isbn: string): Promise<BookInfo | null> {
  const res = await fetchWithTimeout(`https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${encodeURIComponent(isbn)}`)
  if (!res) return null
  const xmlText = await res.text().catch(() => null)
  if (!xmlText) return null
  const doc = new DOMParser().parseFromString(xmlText, 'text/xml')
  if (doc.querySelector('parsererror')) return null
  const item = doc.querySelector('item')
  if (!item) return null
  const title = item.getElementsByTagName('dc:title')[0]?.textContent?.trim() || undefined
  const author = item.getElementsByTagName('dc:creator')[0]?.textContent?.trim() || undefined
  const publisher = item.getElementsByTagName('dc:publisher')[0]?.textContent?.trim() || undefined
  const volumeLabel = item.getElementsByTagName('dcndl:volume')[0]?.textContent?.trim()
  const volumeNumber = volumeLabel ? extractVolumeNumberFromLabel(volumeLabel) ?? undefined : undefined
  const info: BookInfo = { title, author, publisher, volumeNumber }
  return info.title || info.author ? info : null
}

async function lookupGoogleBooks(isbn: string): Promise<BookInfo | null> {
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&country=JP`
  )
  if (!res) return null
  const data = await res.json().catch(() => null)
  const item = data?.items?.[0]
  if (!item) return null
  const v = item.volumeInfo ?? {}
  const info: BookInfo = {
    title: v.title || undefined,
    author: Array.isArray(v.authors) ? v.authors.join('、') : undefined,
    publisher: v.publisher || undefined,
    coverImageUrl: toHttps(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || undefined),
  }
  return info.title || info.author || info.coverImageUrl ? info : null
}

export async function lookupBookByIsbn(isbn: string): Promise<BookInfo | null> {
  const cleaned = isbn.replace(/[^0-9Xx]/g, '')
  const [openBd, ndl, google] = await Promise.all([
    lookupOpenBD(cleaned),
    lookupNdl(cleaned),
    lookupGoogleBooks(cleaned),
  ])
  if (!openBd && !ndl && !google) return null
  return {
    title: openBd?.title || ndl?.title || google?.title,
    author: openBd?.author || ndl?.author || google?.author,
    publisher: openBd?.publisher || ndl?.publisher || google?.publisher,
    coverImageUrl: openBd?.coverImageUrl || google?.coverImageUrl,
    // NDL reports volume as a separate structured field, more reliable than
    // parsing it back out of a combined title string.
    volumeNumber: ndl?.volumeNumber,
  }
}
