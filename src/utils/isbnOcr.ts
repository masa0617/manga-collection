// OCR text tends to misread certain characters as digits look-alikes.
// These substitutions are only applied while hunting for a 13-digit
// 978/979-prefixed run, so a stray correction elsewhere in the string
// can't produce a false positive outside that pattern.
const CONFUSABLE_TO_DIGIT: Record<string, string> = {
  O: '0',
  o: '0',
  I: '1',
  i: '1',
  l: '1',
  L: '1',
  S: '5',
  s: '5',
  B: '8',
  Z: '2',
  z: '2',
  G: '6',
  g: '6',
}

const ISBN13_PATTERN = /97[89]\d{10}/

function correctConfusables(text: string): string {
  return text.replace(/[OoIilLSsBZzGg]/g, (ch) => CONFUSABLE_TO_DIGIT[ch] ?? ch)
}

function findIsbn13In(text: string): string | null {
  const digitsOnly = correctConfusables(text).replace(/[^0-9]/g, '')
  const match = digitsOnly.match(ISBN13_PATTERN)
  return match ? match[0] : null
}

/**
 * Extracts a 13-digit ISBN (no hyphens) from raw OCR text, e.g. turning
 * "ISBN978-4-06-535512-1" into "9784065355121". Prefers the digit run
 * immediately following an "ISBN" label when present, falling back to
 * scanning the whole text so a missed/garbled label doesn't block a
 * clearly-formed 978/979 number.
 */
export function extractIsbnFromText(rawText: string): string | null {
  if (!rawText) return null
  const normalized = rawText.toUpperCase()
  const isbnIndex = normalized.search(/ISBN/)
  if (isbnIndex >= 0) {
    const afterLabel = normalized.slice(isbnIndex + 'ISBN'.length, isbnIndex + 'ISBN'.length + 40)
    const found = findIsbn13In(afterLabel)
    if (found) return found
  }
  return findIsbn13In(normalized)
}
