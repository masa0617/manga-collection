import type { BookInfo } from '../types'

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
    coverImageUrl: summary.cover || undefined,
  }
  return info.title || info.author || info.coverImageUrl ? info : null
}

async function lookupGoogleBooks(isbn: string): Promise<BookInfo | null> {
  const res = await fetchWithTimeout(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`
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
    coverImageUrl: v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || undefined,
  }
  return info.title || info.author || info.coverImageUrl ? info : null
}

export async function lookupBookByIsbn(isbn: string): Promise<BookInfo | null> {
  const cleaned = isbn.replace(/[^0-9Xx]/g, '')
  const [openBd, google] = await Promise.all([lookupOpenBD(cleaned), lookupGoogleBooks(cleaned)])
  if (!openBd && !google) return null
  return {
    title: openBd?.title || google?.title,
    author: openBd?.author || google?.author,
    publisher: openBd?.publisher || google?.publisher,
    coverImageUrl: openBd?.coverImageUrl || google?.coverImageUrl,
  }
}
