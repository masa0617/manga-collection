export interface ParsedTitle {
  seriesName: string
  volumeNumber: number | null
}

// Deliberately excludes "ー" (the katakana prolonged-sound mark, U+30FC):
// it's common as an ordinary word-final character (e.g. a title ending in
// "...ー" before a trailing volume number), so treating it as a strippable
// separator would silently chop the last character off titles like that -
// same reasoning as DASH_WRAP_CLASS below, which excludes it for the same
// reason.
const TRAILING_SEPARATORS = /[\s　\-‐-‒–—―:：・.。]+$/

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

// A number trailing some non-numeric lead-in text, optionally followed by a
// parenthesized annotation - covers dcndl:volume labels that prefix the
// number with a story-arc name instead of (or in addition to) a plain "巻"/
// "第...巻" marker, e.g. "火星編 1" (テラフォーマーズ), "暗黒武術会編 1"
// (幽☆遊☆白書). Anchored to the end of the string, unlike
// extractLeadingVolumeNumber's leading-number match, so the two together
// cover both "number first" and "number last" label shapes.
function extractTrailingVolumeNumber(label: string): number | null {
  const match = toHalfWidth(label).match(/(\d{1,4})\s*(?:[\(（][^()（）]*[\)）])?\s*$/)
  return match ? Number(match[1]) : null
}

// Extracts a volume number from a standalone label like "巻1", "第3巻" or "巻十一"
// (e.g. NDL Search's dcndl:volume field, reported separately from the title).
// Real-world labels are noisier than a bare number/kanji numeral: a leading
// story-arc annotation ("火星編 1"), a leading number with a trailing
// parenthetical annotation ("2 (祈りと呪いとキセキ)"), or both wrapped around
// a "第...巻" marker ("第6巻 (暗黒武術会開幕!!の巻)") all show up in practice -
// falls back to the same leading/trailing number extraction used for the
// noisier title+author search (see extractLeadingVolumeNumber) whenever the
// label isn't cleanly just a number or kanji numeral on its own.
export function extractVolumeNumberFromLabel(label: string): number | null {
  const stripped = label.trim().replace(/^第/, '').replace(/^巻/, '').replace(/巻$/, '').trim()
  if (!stripped) return null
  const direct = kanjiToNumber(stripped)
  if (direct !== null) return direct
  return extractLeadingVolumeNumber(stripped) ?? extractTrailingVolumeNumber(stripped)
}

// A looser sibling of extractVolumeNumberFromLabel for scanning dcndl:volume
// across a whole title+author search's worth of records (see
// estimateSeriesVolumes), where the field is noisier than a single trusted
// per-ISBN lookup: full-width digits ("３２"), a leading "その" counter word
// used by some anthology/4-koma series (e.g. 月曜日のたわわ's "その1"), and a
// trailing arc-name annotation NDL sometimes appends in parens (e.g.
// "1 (死神代行篇 1 (邂逅))", "55 (The blood warfare)"). Reads only the leading
// number and ignores whatever follows, rather than requiring the whole label
// to be nothing but a number.
export function extractLeadingVolumeNumber(label: string): number | null {
  const stripped = toHalfWidth(label.trim()).replace(/^その/, '').trim()
  const match = stripped.match(/^\[?(\d{1,3})\]?/)
  return match ? Number(match[1]) : null
}

// NDL sometimes reports a parallel title joining the original spelling and a
// Japanese reading with "=", e.g. "One piece = ワンピース". Keep only the
// part before it.
function stripParallelTitle(title: string): string {
  const idx = title.indexOf('=')
  return idx === -1 ? title : title.slice(0, idx).trim()
}

// Decorative symbols used as stylized separators/accents within official
// titles - different catalog sources (or different print editions/reissues
// of the same volume) disagree on which one they use, e.g. "幽☆遊☆白書" vs
// "幽・遊・白書" vs "幽★遊★白書" are all real records for the same series.
// Stripped entirely before matching so that stylization drift alone never
// causes a spurious "different series" verdict - see isLikelySameSeries.
// Not used for display: cleanSeriesName (which feeds the actual parsed
// title) leaves these untouched.
const DECORATIVE_SYMBOLS = /[☆★♪♬♡♥●○◎◇◆■□※〇・†‡]/g

// Normalizes a title/series name for equality comparisons (matching a fresh
// scan against an already-registered series), not for display.
export function normalizeForMatch(name: string): string {
  return toHalfWidth(name)
    .replace(DECORATIVE_SYMBOLS, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

// Bibliographic records commonly separate a subtitle with " : " (ISBD
// convention), e.g. "鬼滅の刃 : ヒノカミ血風譚 1". Split it off before running
// the volume-marker patterns below (they all anchor to the end of the
// string) - but only when the colon isn't glued to an ASCII/alphanumeric
// token, since that's a stylized part of the title itself (e.g.
// "Re:ゼロから始める異世界生活"), not a subtitle separator.
function stripColonSubtitle(title: string): string {
  const match = title.match(/^(.*?)[ 　]*[:：][ 　]*(.+)$/)
  if (!match) return title
  const before = match[1]
  const after = match[2]
  if (!before) return title
  if (/[A-Za-z0-9]/.test(before[before.length - 1])) return title
  // A volume number sometimes trails the subtitle instead of the main title
  // (e.g. "鬼滅の刃 : ヒノカミ血風譚 1") - keep it so the volume-marker
  // patterns below can still find it after the subtitle itself is dropped.
  const trailingVolume = after.match(/(第\s*\d{1,4}\s*巻|\d{1,4})\s*$/)
  return trailingVolume ? `${before.trim()} ${trailingVolume[1]}` : before.trim()
}

// Some Japanese bibliographic sources wrap a subtitle in matching dashes
// instead of (or in addition to) an ISBD colon, e.g. "終の退魔師-エンダーガ
// イスター-" or "終の退魔師 ―エンダーガイスター―<注記> 13". This is what
// makes a learned-title match silently stop applying: the user registers a
// series after manually stripping a dash-wrapped subtitle, then the next
// scan's fresh lookup still carries it, and the un-stripped subtitle makes
// the parsed name too different from the registered one for
// isLikelySameSeries to accept. Stripped before the volume-marker patterns
// below, same treatment as stripColonSubtitle - but only when the opening
// dash isn't glued to an ASCII/alphanumeric token, for the same "Re:ゼロ..."
// -style reason stripColonSubtitle guards against.
// Deliberately excludes "ー" (the katakana prolonged-sound mark, U+30FC):
// it's common as an ordinary word-internal character (e.g. "ハンター×ハンタ
// ー" has two), so treating it as a subtitle-wrap delimiter would silently
// truncate titles that have nothing to do with a subtitle.
const DASH_WRAP_CLASS = '\\-\u2010\u2011\u2012\u2013\u2014\u2015'
const DASH_SUBTITLE = new RegExp(
  `^(.+?)[ 　]?[${DASH_WRAP_CLASS}]([^${DASH_WRAP_CLASS}]+)[${DASH_WRAP_CLASS}][ 　]*(.*)$`,
)

function stripDashSubtitle(title: string): string {
  const match = title.match(DASH_SUBTITLE)
  if (!match) return title
  const before = match[1]
  const trailing = match[3]
  if (!before || /[A-Za-z0-9]/.test(before[before.length - 1])) return title
  const trailingVolume = trailing.match(/(第\s*\d{1,4}\s*巻|\d{1,4})\s*$/)
  return trailingVolume ? `${before.trim()} ${trailingVolume[1]}` : before.trim()
}

// Some sources wrap a subtitle or furigana reading in parentheses anywhere
// in the title, e.g. "One piece 巻2 (Versus!!バギー海賊団)" or
// "鬼滅の刃(きめつのやいば) 1". Strip any such parenthetical - but only when
// its contents aren't a bare volume number like "鬼滅の刃(1)", which the
// volume-marker patterns below already handle correctly.
function stripNonNumericParens(title: string): string {
  return title
    .replace(/[\(（]([^()（）]*)[\)）]/g, (whole, inner) => {
      const halfInner = toHalfWidth(inner).trim()
      return /^\d+$/.test(halfInner) ? whole : ' '
    })
    .replace(/\s+/g, ' ')
    .trim()
}

// Bibliographic sources sometimes tack a responsibility-statement role label
// onto a contributor's name instead of (or in addition to) reporting it as
// a separate ONIX contributor role - e.g. "橘賢一 原作", "石田スイ／著" - not
// part of the name itself, and with no separator this module already splits
// on. Stripped from the end of each name fragment.
//
// Single-character labels (著/文/画/絵/編/訳) are only stripped when clearly
// set off by a separator (space/slash/backslash, half- or full-width) or
// parentheses - they're also common word-final characters in ordinary
// Japanese given names (e.g. "山田文"), so stripping one bare, with no
// separator at all, would silently truncate a real name. Multi-character
// labels (作画/原作/etc.) are distinctive enough that a real name ending in
// one - even glued on with no separator, as some catalog fields do - is
// implausible, so those are also stripped bare.
const SINGLE_CHAR_ROLE_LABELS = ['著', '文', '画', '絵', '編', '訳']
// Includes both short ONIX-style verb roles (作画/原作/etc.) and longer
// occupation-noun labels (漫画家/イラストレーター/etc.) - some sources (seen
// from Google Books-style records, e.g. "高橋慶太郎漫画家") report the
// contributor's occupation rather than a responsibility-statement verb, with
// the same glued-with-no-separator pattern.
const MULTI_CHAR_ROLE_LABELS = [
  '作画',
  '原作',
  '脚本',
  '監修',
  '構成',
  '原案',
  '編著',
  '漫画',
  '漫画家',
  '作家',
  'イラストレーター',
  '原作者',
]
const SEPARATED_ROLE_SUFFIX = new RegExp(
  `(?:[\\s　/／\\\\＼]+[（(]?|[（(])(?:${[...SINGLE_CHAR_ROLE_LABELS, ...MULTI_CHAR_ROLE_LABELS].join('|')})[)）]?$`,
)
const BARE_MULTI_CHAR_ROLE_SUFFIX = new RegExp(`(?:${MULTI_CHAR_ROLE_LABELS.join('|')})$`)

function stripRoleLabel(name: string): string {
  return name.replace(SEPARATED_ROLE_SUFFIX, '').replace(BARE_MULTI_CHAR_ROLE_SUFFIX, '').trim()
}

// Both NDL's dc:creator and openBD's summary.author use catalog-style
// "姓,名,生年-没年" entries, e.g. "尾田,栄一郎,1975-" or "尾田/栄一郎" (the
// surname/given-name separator varies). Strip the birth/death year
// fragment and any trailing role label, then join the remaining name parts
// with no separator: "尾田栄一郎".
function formatCatalogPersonName(raw: string): string {
  // Role label first: it must see the string's true trailing edge before
  // the "/" in the split below (also used as a surname/given-name
  // separator, e.g. "尾田/栄一郎") can cut a "／著"-style suffix apart from
  // what it's attached to.
  const withoutRole = stripRoleLabel(raw.trim())
  const withoutDates = withoutRole.replace(/[,，]?\s*\d{3,4}\s*-\s*\d{0,4}\s*\.?\s*$/, '')
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

// Matches either an arabic-digit run or a plain kanji numeral (see
// kanjiToNumber) wherever a volume patterns below expects a number - real
// bibliographic titles use both depending on source/era (e.g. NARUTO's old-
// style "巻ノ58", vs. the far more common arabic "第15巻").
const VOLUME_NUMBER = '(?:\\d{1,4}|[〇一二三四五六七八九十百千]{1,8})'

// ISBNs don't encode a volume number in any standard, decodable way, so the
// best signal available is the volume marker embedded in the book title
// returned by the lookup APIs. Real-world examples seen from openBD/Google:
// "ONE PIECE 105", "鬼滅の刃(1)", "薬屋のひとりごと 第15巻", "One piece 巻1",
// "Naruto. 巻ノ58 (ナルトvsイタチ!!)" (openBD's title for a series still
// catalogued under NDL's old "巻ノN" convention - the ノ/の connector and the
// occasional kanji numeral it carries, e.g. "巻ノ一", previously weren't
// recognized at all, leaving the whole marker stuck in the title and the
// volume number blank).
const VOLUME_PATTERNS: RegExp[] = [
  new RegExp(`^(.*?)[\\s　]*第\\s*(${VOLUME_NUMBER})\\s*巻\\s*$`),
  new RegExp(`^(.*?)[\\s　]*(${VOLUME_NUMBER})\\s*巻\\s*$`),
  // "巻N" / "巻ノN" / "巻の一" - a leading 巻 marker, optionally followed by
  // the ノ/の connector some older-style labels use before the number.
  new RegExp(`^(.*?)[\\s　]*巻[ノの]?\\s*(${VOLUME_NUMBER})\\s*$`),
  /^(.*?)[\s　]*[\(（]\s*(\d{1,4})\s*[\)）]\s*$/,
  /^(.*?)[\s　]+[Vv][Oo][Ll]\.?\s*(\d{1,4})\s*$/,
  /^(.*?)[\s　]+(\d{1,4})\s*$/,
]

export function parseVolumeFromTitle(rawTitle: string): ParsedTitle {
  const normalized = stripParallelTitle(toHalfWidth(rawTitle.trim()))
  const withoutSubtitle = stripNonNumericParens(stripDashSubtitle(stripColonSubtitle(normalized)))
  for (const pattern of VOLUME_PATTERNS) {
    const match = withoutSubtitle.match(pattern)
    if (!match) continue
    const seriesName = cleanSeriesName(match[1])
    const volumeNumber = kanjiToNumber(match[2])
    if (seriesName && volumeNumber !== null && volumeNumber > 0) {
      return { seriesName, volumeNumber }
    }
  }
  return { seriesName: cleanSeriesName(withoutSubtitle), volumeNumber: null }
}

const HIRAGANA_KATAKANA_ONLY = /^[぀-ゟ゠-ヿー\s　]+$/

export interface KanaSortKey {
  // Bucket 0 holds names with a confirmed reading - either a captured
  // kanaReading or a name that's already all kana - safe to compare directly
  // with a kana-aware collator. Bucket 1 holds everything else (kanji with no
  // captured reading, stylized Latin titles like "BLEACH" whose real
  // Japanese reading has no phonetic relationship to the English spelling):
  // guessing at those produces confidently *wrong* sort positions (e.g. a
  // naive romaji transliteration of "BLEACH" lands it under the "え" row),
  // which is worse than a plain, predictable rule. They're sorted after
  // every bucket-0 entry instead, ordered by their own text.
  bucket: 0 | 1
  key: string
}

// Best-effort sort key for 50-on (gojuuon) ordering: prefers the real
// reading captured from NDL (kanaReading), falls back to the name itself
// when it's already all kana, and otherwise defers to bucket 1 - see
// KanaSortKey.
export function getKanaSortKey(name: string, kanaReading?: string): KanaSortKey {
  if (kanaReading) return { bucket: 0, key: toHalfWidth(kanaReading).replace(/\s+/g, '') }
  const trimmed = name.trim()
  if (HIRAGANA_KATAKANA_ONLY.test(trimmed)) return { bucket: 0, key: trimmed }
  return { bucket: 1, key: trimmed }
}

const kanaCollator = new Intl.Collator('ja')

export function compareKanaSortKeys(a: KanaSortKey, b: KanaSortKey): number {
  if (a.bucket !== b.bucket) return a.bucket - b.bucket
  if (a.bucket === 0) return kanaCollator.compare(a.key, b.key)
  // Bucket 1 (unknown reading): ordered by the title's own character code,
  // per a plain, predictable rule rather than a guess.
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}

export function compareByKana(a: { name: string; kanaReading?: string }, b: { name: string; kanaReading?: string }): number {
  return compareKanaSortKeys(getKanaSortKey(a.name, a.kanaReading), getKanaSortKey(b.name, b.kanaReading))
}
