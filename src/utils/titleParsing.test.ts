import { describe, expect, it } from 'vitest'
import {
  extractVolumeNumberFromLabel,
  formatCatalogAuthors,
  normalizeForMatch,
  parseVolumeFromTitle,
} from './titleParsing'

describe('formatCatalogAuthors', () => {
  it('joins multiple co-authors with 、 (not a half-width space)', () => {
    expect(formatCatalogAuthors(['尾田,栄一郎,1975-'])).toBe('尾田栄一郎')
    expect(formatCatalogAuthors(['貴家,悠,1988-', '橘,賢一,1977-'])).toBe('貴家悠、橘賢一')
  })

  it('splits a single field on a semicolon into separate co-authors', () => {
    expect(formatCatalogAuthors(['貴家悠;橘賢一'])).toBe('貴家悠、橘賢一')
    expect(formatCatalogAuthors(['貴家悠；橘賢一'])).toBe('貴家悠、橘賢一')
  })

  it('strips a trailing role label separated by a space', () => {
    expect(formatCatalogAuthors(['橘賢一 原作'])).toBe('橘賢一')
    expect(formatCatalogAuthors(['石田スイ 作画'])).toBe('石田スイ')
  })

  it('strips a trailing role label separated by a full-width or half-width slash/backslash', () => {
    expect(formatCatalogAuthors(['石田スイ／著'])).toBe('石田スイ')
    expect(formatCatalogAuthors(['石田スイ＼著'])).toBe('石田スイ')
    expect(formatCatalogAuthors(['石田スイ/著'])).toBe('石田スイ')
  })

  it('strips a parenthesized trailing role label', () => {
    expect(formatCatalogAuthors(['石田スイ(著)'])).toBe('石田スイ')
    expect(formatCatalogAuthors(['石田スイ（著）'])).toBe('石田スイ')
  })

  it('strips role labels from each co-author independently within one comma-joined field', () => {
    expect(formatCatalogAuthors(['貴家悠, 橘賢一 原作'])).toBe('貴家悠橘賢一')
  })

  it('does not strip a single-character role-label lookalike with no separator (real given names can end in 著/文/画/絵/編/訳)', () => {
    expect(formatCatalogAuthors(['山田文'])).toBe('山田文')
    expect(formatCatalogAuthors(['田中太郎'])).toBe('田中太郎')
  })

  it('does strip a multi-character role label even glued on with no separator (distinctive enough to be unambiguous)', () => {
    expect(formatCatalogAuthors(['貴家悠原作'])).toBe('貴家悠')
  })

  // Regression: occupation-noun labels (as opposed to short ONIX-style verb
  // roles like 作画/原作) were previously missing from the role-label list
  // entirely, so a name like "高橋慶太郎漫画家" passed through unstripped.
  it('strips an occupation-noun role label glued on with no separator', () => {
    expect(formatCatalogAuthors(['高橋慶太郎漫画家'])).toBe('高橋慶太郎')
    expect(formatCatalogAuthors(['尾田栄一郎 漫画家'])).toBe('尾田栄一郎')
    expect(formatCatalogAuthors(['石田スイ(イラストレーター)'])).toBe('石田スイ')
  })

  it('strips birth/death year and role label together', () => {
    expect(formatCatalogAuthors(['尾田,栄一郎,1975- 著'])).toBe('尾田栄一郎')
  })

  it('passes clean, already-plain names through unchanged (Google Books-style input)', () => {
    expect(formatCatalogAuthors(['Eiichiro Oda'])).toBe('Eiichiro Oda')
    expect(formatCatalogAuthors(['Eiichiro Oda', 'Someone Else'])).toBe('Eiichiro Oda、Someone Else')
  })
})

describe('extractVolumeNumberFromLabel', () => {
  it('extracts a bare number or kanji numeral (existing behavior)', () => {
    expect(extractVolumeNumberFromLabel('1')).toBe(1)
    expect(extractVolumeNumberFromLabel('第3巻')).toBe(3)
    expect(extractVolumeNumberFromLabel('巻十一')).toBe(11)
  })

  // Real NDL dcndl:volume label for テラフォーマーズ - prefixes the number
  // with a story-arc name instead of a plain "巻"/"第...巻" marker, which
  // previously made the volume come out blank for every scanned volume.
  it('extracts the number from a label with a leading story-arc name (テラフォーマーズ)', () => {
    expect(extractVolumeNumberFromLabel('火星編 1')).toBe(1)
    expect(extractVolumeNumberFromLabel('火星編 7')).toBe(7)
  })

  // Real NDL dcndl:volume label for 幽☆遊☆白書.
  it('extracts the number from a label with a leading story-arc name (幽☆遊☆白書)', () => {
    expect(extractVolumeNumberFromLabel('暗黒武術会編 1')).toBe(1)
  })

  it('extracts the number from a "第N巻" label with a trailing parenthesized annotation', () => {
    expect(extractVolumeNumberFromLabel('第6巻 (暗黒武術会開幕!!の巻)')).toBe(6)
  })

  it('extracts the number from a leading-number label with a trailing parenthesized annotation', () => {
    expect(extractVolumeNumberFromLabel('2 (祈りと呪いとキセキ)')).toBe(2)
  })
})

describe('parseVolumeFromTitle', () => {
  // Real openBD title for 神のみぞ知るセカイ vol. 5 - the volume number
  // trails the series name after a bare "." (JAPAN/MARC-style), not a space
  // or 巻 marker.
  it('parses a volume number trailing a bare period separator (神のみぞ知るセカイ)', () => {
    expect(parseVolumeFromTitle('神のみぞ知るセカイ. 5')).toEqual({
      seriesName: '神のみぞ知るセカイ',
      volumeNumber: 5,
    })
  })

  // Real NDL title for 終の退魔師 - the subtitle is wrapped in matching
  // dashes rather than an ISBD colon. Previously left in place, which broke
  // matching against a registered series whose subtitle was manually
  // stripped (see isLikelySameSeries / seriesMatching.test.ts).
  it('strips a dash-wrapped subtitle (終の退魔師)', () => {
    expect(parseVolumeFromTitle('終の退魔師-エンダーガイスター-')).toEqual({
      seriesName: '終の退魔師',
      volumeNumber: null,
    })
  })

  it('strips a dash-wrapped subtitle using the em-dash/horizontal-bar variant with a trailing volume number', () => {
    expect(parseVolumeFromTitle('終の退魔師 ―エンダーガイスター― 13')).toEqual({
      seriesName: '終の退魔師',
      volumeNumber: 13,
    })
  })

  it('does not treat the katakana prolonged-sound mark as a subtitle-wrap delimiter (regression)', () => {
    expect(parseVolumeFromTitle('ハンター×ハンター外伝 1')).toEqual({
      seriesName: 'ハンター×ハンター外伝',
      volumeNumber: 1,
    })
  })

  it('does not strip a lone hyphen glued to an alphanumeric token (regression)', () => {
    expect(parseVolumeFromTitle('Dr.STONE 1')).toEqual({
      seriesName: 'Dr.STONE',
      volumeNumber: 1,
    })
  })
})

describe('normalizeForMatch', () => {
  // 幽☆遊☆白書 - real NDL records for the same series spell this with ☆, ・,
  // and ★ depending on the catalog entry/edition. Different decorative
  // symbols must normalize to the same key or the learned-title match
  // (isLikelySameSeries) treats them as different series.
  it('treats ☆/・/★ decorative-symbol variants as equal (幽☆遊☆白書)', () => {
    const withStar = normalizeForMatch('幽☆遊☆白書')
    const withDot = normalizeForMatch('幽・遊・白書')
    const withStar2 = normalizeForMatch('幽★遊★白書')
    expect(withStar).toBe(withDot)
    expect(withStar).toBe(withStar2)
    expect(withStar).toBe('幽遊白書')
  })
})
