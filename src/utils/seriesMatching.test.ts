import { describe, expect, it } from 'vitest'
import { isLikelySameSeries, isbnPublisherCode } from './seriesMatching'
import { normalizeForMatch } from './titleParsing'

describe('isLikelySameSeries', () => {
  it('matches identical normalized names', () => {
    expect(isLikelySameSeries(normalizeForMatch('ONE PIECE'), normalizeForMatch('ONE PIECE'))).toBe(true)
  })

  it('matches a special-edition suffix on an otherwise-known name via the plain prefix rule (no corroboration needed)', () => {
    expect(isLikelySameSeries(normalizeForMatch('薬屋のひとりごと'), normalizeForMatch('薬屋のひとりごと外伝'))).toBe(true)
  })

  it('rejects two short, unrelated titles with no corroboration', () => {
    expect(isLikelySameSeries(normalizeForMatch('鬼滅の刃'), normalizeForMatch('進撃の巨人'))).toBe(false)
  })

  // "からかい上手の高木さん" vs "からかい上手の(元)高木さん" - similarity ~0.786:
  // above the corroborated threshold (0.70) but below the uncorroborated one
  // (0.82), and not a simple prefix (the insertion is in the middle) - the
  // real case a long-running series' title-wording drift lands in.
  it('rejects a moderately different title (0.70-0.82 similarity) with no corroboration', () => {
    expect(
      isLikelySameSeries(normalizeForMatch('からかい上手の高木さん'), normalizeForMatch('からかい上手の(元)高木さん')),
    ).toBe(false)
  })

  it('accepts that same moderately different title when the author matches exactly', () => {
    expect(
      isLikelySameSeries(normalizeForMatch('からかい上手の高木さん'), normalizeForMatch('からかい上手の(元)高木さん'), {
        candidateAuthor: normalizeForMatch('山本崇一朗'),
        knownAuthor: normalizeForMatch('山本崇一朗'),
      }),
    ).toBe(true)
  })

  it('treats one author string containing the other as corroborating (e.g. original story + art credited vs. a single name on file)', () => {
    expect(
      isLikelySameSeries(normalizeForMatch('からかい上手の高木さん'), normalizeForMatch('からかい上手の(元)高木さん'), {
        candidateAuthor: normalizeForMatch('山本崇一朗ほか'),
        knownAuthor: normalizeForMatch('山本崇一朗'),
      }),
    ).toBe(true)
  })

  it('does not let a matching author alone rescue a wildly different title', () => {
    expect(
      isLikelySameSeries(normalizeForMatch('鬼滅の刃'), normalizeForMatch('progressive'), {
        candidateAuthor: normalizeForMatch('尾田栄一郎'),
        knownAuthor: normalizeForMatch('尾田栄一郎'),
      }),
    ).toBe(false)
  })

  // "東京卍リベンジャーズ" vs "東京リベンジャーズ外伝" - similarity ~0.727,
  // same corroborated-threshold band as the author case above.
  it('accepts a moderately different title when ISBN publisher codes match (existing behavior preserved)', () => {
    expect(
      isLikelySameSeries(normalizeForMatch('東京卍リベンジャーズ'), normalizeForMatch('東京リベンジャーズ外伝'), {
        candidateIsbn: '9784088805551',
        knownIsbn: '9784088805995',
      }),
    ).toBe(true)
  })
})

describe('isbnPublisherCode', () => {
  it('extracts the 6-digit prefix from a 13-digit ISBN', () => {
    expect(isbnPublisherCode('9784088805551')).toBe('978408')
  })

  it('returns null for a malformed ISBN', () => {
    expect(isbnPublisherCode('not-an-isbn')).toBeNull()
    expect(isbnPublisherCode(undefined)).toBeNull()
  })
})
