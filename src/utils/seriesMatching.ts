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

/**
 * Whether a freshly-parsed candidate title likely refers to the same series
 * as an already-registered one, tolerating the residual noise (stray
 * subtitle/ruby fragments, punctuation) that title parsing can't always
 * fully strip. Both names must already be run through normalizeForMatch.
 * An ISBN publisher-code match on both sides relaxes the similarity bar
 * slightly, since two differently-titled series from the same imprint
 * matching this closely is unlikely to be a coincidence.
 */
export function isLikelySameSeries(
  candidateNormalized: string,
  knownNormalized: string,
  candidateIsbn?: string,
  knownIsbn?: string,
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

  const candidateCode = isbnPublisherCode(candidateIsbn)
  const knownCode = isbnPublisherCode(knownIsbn)
  if (candidateCode && candidateCode === knownCode && score >= CORROBORATED_SIMILARITY_THRESHOLD) return true

  return false
}
