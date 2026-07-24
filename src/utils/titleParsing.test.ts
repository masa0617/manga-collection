import { describe, expect, it } from 'vitest'
import { formatCatalogAuthors } from './titleParsing'

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
