export interface ParsedTitle {
  seriesName: string
  volumeNumber: number | null
}

const TRAILING_SEPARATORS = /[\s　\-‐-‒–—―ー:：・.。]+$/

function cleanSeriesName(raw: string): string {
  return raw.replace(TRAILING_SEPARATORS, '').trim()
}

const KANJI_DIGITS: Record<string, number> = {
  〇: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
}

// Full-width Latin letters/digits/punctuation (U+FF01-FF5E) and the
// full-width space (U+3000) show up often in Japanese bibliographic data
// (e.g. "ＯＮＥ　ＰＩＥＣＥ"). Normalizing to half-width keeps titles/volume
// labels closer to their official printed form and makes the volume-number
// regexes below work regardless of which width the source used.
export function toHalfWidth(str: string): string {
  return str
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
}

// Handles plain kanji numerals used for volume labels, e.g. NDL's "巻一"/"巻十一".
// Not a full Japanese numeral parser, but covers the 1-999 range real volume
// numbers fall in.
export function kanjiToNumber(raw: string): number | null {
  const str = toHalfWidth(raw.trim())
  if (/^\d+$/.test(str)) return parseInt(str, 10)
  if (!/^[〇一二三四五六七八九十百千]+$/.test(str)) return null
  let result = 0
  let current = 0
  for (const ch of str) {
    if (ch === '十') {
      current = (current || 1) * 10
      result += current
      current = 0
    } else if (ch === '百') {
      current = (current || 1) * 100
      result += current
      current = 0
    } else if (ch === '千') {
      current = (current || 1) * 1000
      result += current
      current = 0
    } else {
      current = KANJI_DIGITS[ch]
    }
  }
  result += current
  return result > 0 ? result : null
}

// Extracts a volume number from a standalone label like "巻1", "第3巻" or "巻十一"
// (e.g. NDL Search's dcndl:volume field, reported separately from the title).
export function extractVolumeNumberFromLabel(label: string): number | null {
  const stripped = label.trim().replace(/^第/, '').replace(/^巻/, '').replace(/巻$/, '').trim()
  if (!stripped) return null
  return kanjiToNumber(stripped)
}

// NDL sometimes reports a parallel title joining the original spelling and a
// Japanese reading with "=", e.g. "One piece = ワンピース". Keep only the
// part before it.
function stripParallelTitle(title: string): string {
  const idx = title.indexOf('=')
  return idx === -1 ? title : title.slice(0, idx).trim()
}

// Normalizes a title/series name for equality comparisons (matching a fresh
// scan against an already-registered series), not for display.
export function normalizeForMatch(name: string): string {
  return toHalfWidth(name).trim().toLowerCase().replace(/\s+/g, '')
}

// Some sources append a subtitle in trailing parentheses, e.g.
// "One piece 巻2 (Versus!!バギー海賊団)". That breaks every volume-marker
// pattern below (they all anchor to the end of the string), so strip it
// first - but only when the parenthesized text isn't itself a bare volume
// number like "鬼滅の刃(1)", which the patterns already handle correctly.
function stripTrailingSubtitle(title: string): string {
  const match = title.match(/^(.*?)\s*[\(（]([^()（）]*)[\)）]\s*$/)
  if (!match) return title
  const inner = toHalfWidth(match[2]).trim()
  if (/^\d+$/.test(inner)) return title
  return match[1].trim()
}

// Both NDL's dc:creator and openBD's summary.author use catalog-style
// "姓,名,生年-没年" entries, e.g. "尾田,栄一郎,1975-" or "尾田/栄一郎" (the
// surname/given-name separator varies). Strip the birth/death year
// fragment, then join the remaining name parts with no separator: "尾田栄一郎".
function formatCatalogPersonName(raw: string): string {
  const withoutDates = raw.trim().replace(/[,，]?\s*\d{3,4}\s*-\s*\d{0,4}\s*\.?\s*$/, '')
  return withoutDates
    .split(/[,，/]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('')
}

// A record can have multiple contributors (original story / art), reported
// either as separate fields or joined with "; " in one.
export function formatCatalogAuthors(rawValues: string[]): string {
  return rawValues
    .flatMap((v) => v.split(/;|；/))
    .map((part) => formatCatalogPersonName(part))
    .filter(Boolean)
    .join('、')
}

// ISBNs don't encode a volume number in any standard, decodable way, so the
// best signal available is the volume marker embedded in the book title
// returned by the lookup APIs. Real-world examples seen from openBD/Google:
// "ONE PIECE 105", "鬼滅の刃(1)", "薬屋のひとりごと 第15巻", "One piece 巻1".
const VOLUME_PATTERNS: RegExp[] = [
  /^(.*?)[\s　]*第\s*(\d{1,4})\s*巻\s*$/,
  /^(.*?)[\s　]*(\d{1,4})\s*巻\s*$/,
  /^(.*?)[\s　]*巻\s*(\d{1,4})\s*$/,
  /^(.*?)[\s　]*[\(（]\s*(\d{1,4})\s*[\)）]\s*$/,
  /^(.*?)[\s　]+[Vv][Oo][Ll]\.?\s*(\d{1,4})\s*$/,
  /^(.*?)[\s　]+(\d{1,4})\s*$/,
]

export function parseVolumeFromTitle(rawTitle: string): ParsedTitle {
  const normalized = stripParallelTitle(toHalfWidth(rawTitle.trim()))
  const withoutSubtitle = stripTrailingSubtitle(normalized)
  for (const pattern of VOLUME_PATTERNS) {
    const match = withoutSubtitle.match(pattern)
    if (!match) continue
    const seriesName = cleanSeriesName(match[1])
    const volumeNumber = Number(match[2])
    if (seriesName && Number.isInteger(volumeNumber) && volumeNumber > 0) {
      return { seriesName, volumeNumber }
    }
  }
  return { seriesName: cleanSeriesName(withoutSubtitle), volumeNumber: null }
}
