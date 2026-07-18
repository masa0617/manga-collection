import type { IpadicFeatures, Tokenizer } from 'kuromoji'
import { toHalfWidth } from './titleParsing'

// On-device reading generation, shared by the wishlist (its only source of a
// reading - see wishlistKanaScheduler) and the library as a last-resort
// fallback for titles NDL Search never resolves (see volumeCheckScheduler).
// Runs entirely locally against a bundled IPADIC dictionary - no network
// call, so unlike the NDL-based paths this never flakes on hand-typed
// titles, publisher-record mismatches, or API downtime (see the wishlist
// kana sort investigation this replaced).

let tokenizerPromise: Promise<Tokenizer<IpadicFeatures>> | null = null

// Browser: the dictionary is copied into public/dict/kuromoji at install
// time (see scripts/copy-kuromoji-dict.mjs) and fetched from there.
// Node/vitest: kuromoji reads the files straight off disk from the package
// itself, no copy needed.
function dicPath(): string {
  if (typeof window === 'undefined') return 'node_modules/kuromoji/dict/'
  return `${import.meta.env.BASE_URL}dict/kuromoji/`
}

function getTokenizer(): Promise<Tokenizer<IpadicFeatures>> {
  if (!tokenizerPromise) {
    tokenizerPromise = import('kuromoji').then(
      (kuromoji) =>
        new Promise((resolve, reject) => {
          kuromoji.builder({ dicPath: dicPath() }).build((err, tokenizer) => {
            if (err) reject(err)
            else resolve(tokenizer)
          })
        }),
    )
  }
  return tokenizerPromise
}

// Tokens that are pure punctuation/whitespace carry no meaningful reading
// and are safe to drop rather than treating them as unresolved - mirrors the
// separator set titleParsing already treats as decorative.
const PUNCTUATION_ONLY =
  /^[、。・！？!?…「」『』()（）\[\]【】{}〈〉《》〜~\s　\-‐-‒–—―ー:：.,，"'"'']+$/

const KANA_ONLY = /^[぀-ゟ゠-ヿー\s　]*$/
const HIRAGANA = /[぀-ゟ]/g

// A token with no dictionary reading but an already-kana surface form (a
// katakana loanword absent from IPADIC, or a hiragana particle/okurigana
// fragment left over from an odd tokenizer split) is appended as-is - but
// hiragana must be converted to katakana first, or it'd pollute an otherwise
// all-katakana reading with mixed kana and produce an inconsistent sort key.
function toKatakana(str: string): string {
  return str.replace(HIRAGANA, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60))
}

const KANJI_DIGIT_CHARS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']

// Real titles routinely embed a calendar/counter numeral as an Arabic digit
// next to kanji (e.g. "3月のライオン", "2月の勝者") where the intended
// reading is the native Japanese numeral in context ("サンガツ", not a
// digit-by-digit spelling) - kuromoji's dictionary only recognizes the kanji
// spelling of numbers as part of a compound like "三月", not the Arabic
// digit "3" next to it. Converting up front lets kuromoji's own tokenizer
// resolve the compound (and its context-dependent reading) normally instead
// of leaving every such title unresolved. Capped at 4 digits (thousands) -
// comfortably covers years/volume-style numbers actually seen in titles
// without guessing at man'yomi groupings for arbitrarily large numbers.
function arabicToKanjiNumeral(digits: string): string {
  const n = Number(digits)
  if (n === 0) return '〇'
  const units = ['', '十', '百', '千']
  const str = String(n)
  let result = ''
  for (let i = 0; i < str.length; i++) {
    const d = Number(str[i])
    const unit = units[str.length - 1 - i]
    if (d === 0) continue
    result += d === 1 && unit !== '' ? '' : KANJI_DIGIT_CHARS[d]
    result += unit
  }
  return result
}

function preprocessDigits(title: string): string {
  return toHalfWidth(title).replace(/\d{1,4}/g, arabicToKanjiNumeral)
}

// The three particles は/へ/を are pronounced (and read aloud) differently
// from their literal kana - ワ/エ/オ - but IPADIC's `reading` feature gives
// the literal citation form (ハ/ヘ/ヲ) instead, since that's the dictionary
// spelling. Left uncorrected, titles differing only in whether they hit this
// case would sort under the wrong row entirely (e.g. "...は..." would sort
// under は/ハ instead of properly falling under わ/ワ).
const PARTICLE_PRONUNCIATION: Record<string, string> = { は: 'ワ', へ: 'エ', を: 'オ' }

function particleAwareReading(token: IpadicFeatures): string | undefined {
  if (token.pos === '助詞' && token.surface_form in PARTICLE_PRONUNCIATION) {
    return PARTICLE_PRONUNCIATION[token.surface_form]
  }
  return token.reading
}

/**
 * Generates a 50-on (gojuuon) sort reading for a title by tokenizing it with
 * kuromoji and concatenating each token's katakana reading - the same shape
 * NDL Search's dcndl:titleTranscription uses (see BookInfo.titleReading),
 * so it slots into the existing getKanaSortKey/compareByKana pipeline
 * unchanged.
 *
 * Returns null when any token can't be confidently converted (an unknown
 * word with no dictionary reading and a non-kana surface form - a proper
 * noun, stylized Latin title, etc.) rather than guessing: a partially-wrong
 * reading produces a confidently *wrong* sort position, which is worse than
 * falling back to the existing "unresolved" tail-group rule in
 * titleParsing.KanaSortKey.
 */
export async function generateKanaReading(title: string): Promise<string | null> {
  const trimmed = title.trim()
  if (!trimmed) return null

  let tokenizer: Tokenizer<IpadicFeatures>
  try {
    tokenizer = await getTokenizer()
  } catch (err) {
    console.error(err)
    return null
  }

  let reading = ''
  for (const token of tokenizer.tokenize(preprocessDigits(trimmed))) {
    const surface = token.surface_form
    if (PUNCTUATION_ONLY.test(surface)) continue
    const tokenReading = particleAwareReading(token)
    if (tokenReading) {
      reading += tokenReading
    } else if (KANA_ONLY.test(surface)) {
      reading += toKatakana(surface)
    } else {
      return null
    }
  }

  const cleaned = reading.trim()
  return cleaned || null
}
