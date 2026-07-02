export interface ParsedTitle {
  seriesName: string
  volumeNumber: number | null
}

const TRAILING_SEPARATORS = /[\s　\-‐-‒–—―ー:：・]+$/

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

function toHalfWidthDigits(str: string): string {
  return str.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

// Handles plain kanji numerals used for volume labels, e.g. NDL's "巻一"/"巻十一",
// as well as full-width digits (NDL also reports volumes like "３").
// Not a full Japanese numeral parser, but covers the 1-999 range real volume
// numbers fall in.
export function kanjiToNumber(raw: string): number | null {
  const str = toHalfWidthDigits(raw.trim())
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

export function parseVolumeFromTitle(title: string): ParsedTitle {
  const trimmed = title.trim()
  for (const pattern of VOLUME_PATTERNS) {
    const match = trimmed.match(pattern)
    if (!match) continue
    const seriesName = cleanSeriesName(match[1])
    const volumeNumber = Number(match[2])
    if (seriesName && Number.isInteger(volumeNumber) && volumeNumber > 0) {
      return { seriesName, volumeNumber }
    }
  }
  return { seriesName: trimmed, volumeNumber: null }
}
