import type { BookInfo } from '../types'
import {
  extractVolumeNumberFromLabel,
  formatCatalogAuthors,
  parseVolumeFromTitle,
  toHalfWidth,
} from '../utils/titleParsing'
import { parsePublishDate } from '../utils/publishDate'

// Shorter timeout than a "give the network every benefit of the doubt"
// default: with ~2000 volumes to register, worst-case latency per scan adds
// up fast, and these APIs normally answer in well under a second.
const REQUEST_TIMEOUT_MS = 4000

async function fetchWithTimeout(url: string, ms = REQUEST_TIMEOUT_MS): Promise<Response | null> {
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
    title: summary.title ? toHalfWidth(summary.title) : undefined,
    author: summary.author ? formatCatalogAuthors([summary.author]) || undefined : undefined,
    publisher: summary.publisher || undefined,
    coverImageUrl: toHttps(summary.cover || undefined),
    // openBD's "series" field is the book's imprint/label (e.g. "ジャンプ・
    // コミックス"), the closest structured proxy we have to a serialization magazine.
    magazine: summary.series || undefined,
    releaseDateISO: parsePublishDate(summary.pubdate),
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
  const rawTitle = item.getElementsByTagName('dc:title')[0]?.textContent?.trim()
  const title = rawTitle ? toHalfWidth(rawTitle) : undefined
  const creatorValues = Array.from(item.getElementsByTagName('dc:creator'))
    .map((el) => el.textContent?.trim())
    .filter((v): v is string => Boolean(v))
  const author = creatorValues.length ? formatCatalogAuthors(creatorValues) || undefined : undefined
  const publisher = item.getElementsByTagName('dc:publisher')[0]?.textContent?.trim() || undefined
  const magazine = item.getElementsByTagName('dcndl:seriesTitle')[0]?.textContent?.trim() || undefined
  const volumeLabel = item.getElementsByTagName('dcndl:volume')[0]?.textContent?.trim()
  const volumeNumber = volumeLabel ? extractVolumeNumberFromLabel(volumeLabel) ?? undefined : undefined
  const info: BookInfo = { title, author, publisher, magazine, volumeNumber }
  return info.title || info.author ? info : null
}

// Google Books' keyless/anonymous quota is currently capped at 0 requests/day
// (confirmed via a live 429 "quota_limit_value: 0" response), so this source
// is skipped entirely unless a free API key is configured. See README for
// how to get one - it's what makes cover images and publish dates reliable.
const GOOGLE_BOOKS_API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY as string | undefined

async function lookupGoogleBooks(isbn: string): Promise<BookInfo | null> {
  if (!GOOGLE_BOOKS_API_KEY) return null
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}&country=JP&key=${GOOGLE_BOOKS_API_KEY}`
  )
  if (!res) return null
  const data = await res.json().catch(() => null)
  const item = data?.items?.[0]
  if (!item) return null
  const v = item.volumeInfo ?? {}
  const info: BookInfo = {
    title: v.title ? toHalfWidth(v.title) : undefined,
    author: Array.isArray(v.authors) ? v.authors.join('、') : undefined,
    publisher: v.publisher || undefined,
    coverImageUrl: toHttps(v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || undefined),
    releaseDateISO: parsePublishDate(v.publishedDate),
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
  // NDL's title, when present, is already clean (its volume number lives in
  // a separate field) so it won't carry a parseable marker - but that
  // doesn't mean no source had one. Fall back to whichever raw title
  // (openBD's/Google's) does encode one before giving up.
  const volumeNumber =
    ndl?.volumeNumber ??
    parseVolumeFromTitle(openBd?.title ?? '').volumeNumber ??
    parseVolumeFromTitle(google?.title ?? '').volumeNumber ??
    undefined
  return {
    // NDL tends to preserve the officially printed stylization (e.g. "ONE
    // PIECE") more faithfully than openBD, which sometimes normalizes case
    // (e.g. "One piece") - prefer it for the title specifically.
    title: ndl?.title || openBd?.title || google?.title,
    author: openBd?.author || ndl?.author || google?.author,
    publisher: openBd?.publisher || ndl?.publisher || google?.publisher,
    coverImageUrl: openBd?.coverImageUrl || google?.coverImageUrl,
    magazine: openBd?.magazine || ndl?.magazine,
    releaseDateISO: openBd?.releaseDateISO || google?.releaseDateISO,
    volumeNumber,
  }
}
