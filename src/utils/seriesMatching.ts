function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }
  return dp[b.length]
}

function similarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length)
}

// Practical proxy for "same publisher family": prefix + group + leading
// registrant digits of an ISBN-13. We don't have the official registrant
// range tables to split the boundary exactly, but this is enough to
// corroborate a fuzzy title match between two ISBNs from the same imprint.
export function isbnPublisherCode(isbn: string | undefined): string | null {
  if (!isbn || !/^\d{13}$/.test(isbn)) return null
  return isbn.slice(0, 6)
}

const SIMILARITY_THRESHOLD = 0.82
const CORROBORATED_SIMILARITY_THRESHOLD = 0.7
const MIN_COMPARABLE_LENGTH = 4
const MIN_PREFIX_RATIO = 0.6

export interface SeriesMatchCorroboration {
  candidateIsbn?: string
  knownIsbn?: string
  // Both must already be normalized the same way as candidateNormalized/
  // knownNormalized (see normalizeForMatch) - callers own that, this module
  // only compares what it's given.
  candidateAuthor?: string
  knownAuthor?: string
}

// Same author on both sides is corroborating evidence for "same series"
// independent of ISBN (e.g. a special edition/spin-off registered without a
// scanned ISBN yet, or two ISBNs from different imprints for the same
// series). A simple containment check tolerates one side listing extra
// co-authors (original story + art) that the other doesn't.
function authorsCorroborate(a?: string, b?: string): boolean {
  if (!a || !b) return false
  return a.includes(b) || b.includes(a)
}

// A digit run embedded in a title (as opposed to a volume-number suffix,
// which callers already strip before this comparison runs - see
// parseVolumeFromTitle) is usually part of the title's identity rather than
// incidental noise: "デストロ246" vs "デストロ016" is the same author writing
// two distinct series (one a prequel) that just happen to share a name
// prefix, not wording drift on one series. Neither an author match nor a
// same-publisher ISBN prefix is strong enough evidence to bridge a
// difference like that, so any corroborated match is refused whenever both
// sides contain digits and those digits differ - the exact-equality and
// plain-prefix checks above still handle genuinely identical or
// truncated/extended titles first.
function extractDigits(s: string): string {
  return s.match(/\d+/g)?.join('') ?? ''
}

function hasConflictingDigits(a: string, b: string): boolean {
  const da = extractDigits(a)
  const db = extractDigits(b)
  return da !== '' && db !== '' && da !== db
}

/**
 * Whether a freshly-parsed candidate title likely refers to the same series
 * as an already-registered one, tolerating the residual noise (stray
 * subtitle/ruby fragments, punctuation, special-edition subtitles) that
 * title parsing can't always fully strip. Both names must already be run
 * through normalizeForMatch. An ISBN publisher-code match or a matching
 * author on both sides relaxes the similarity bar, since either makes a
 * coincidental near-match far less likely.
 */
export function isLikelySameSeries(
  candidateNormalized: string,
  knownNormalized: string,
  corroboration: SeriesMatchCorroboration = {},
): boolean {
  if (!candidateNormalized || !knownNormalized) return false
  if (candidateNormalized === knownNormalized) return true

  const [shorter, longer] =
    candidateNormalized.length <= knownNormalized.length
      ? [candidateNormalized, knownNormalized]
      : [knownNormalized, candidateNormalized]
  if (
    shorter.length >= MIN_COMPARABLE_LENGTH &&
    longer.startsWith(shorter) &&
    shorter.length / longer.length >= MIN_PREFIX_RATIO
  ) {
    return true
  }

  if (Math.min(candidateNormalized.length, knownNormalized.length) < MIN_COMPARABLE_LENGTH) return false
  const score = similarity(candidateNormalized, knownNormalized)
  if (score >= SIMILARITY_THRESHOLD) return true
  if (hasConflictingDigits(candidateNormalized, knownNormalized)) return false

  const candidateCode = isbnPublisherCode(corroboration.candidateIsbn)
  const knownCode = isbnPublisherCode(corroboration.knownIsbn)
  const isbnCorroborated = Boolean(candidateCode && candidateCode === knownCode)
  const authorCorroborated = authorsCorroborate(corroboration.candidateAuthor, corroboration.knownAuthor)
  if ((isbnCorroborated || authorCorroborated) && score >= CORROBORATED_SIMILARITY_THRESHOLD) return true

  return false
}
