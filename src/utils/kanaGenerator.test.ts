import { describe, expect, it, beforeAll } from 'vitest'
import { generateKanaReading } from './kanaGenerator'
import { compareByKana } from './titleParsing'

// Real manga titles this app's users would plausibly type into the wishlist
// by hand, verified against their actual published furigana/reading. This
// is the regression test for the wishlist kana-sort bug (see
// wishlistKanaScheduler.ts) - every entry's generated reading and the full
// list's resulting 50-on order are asserted exactly, not just "some order".
//
// AUTO group: titles where kuromoji's IPADIC-based tokenization produces the
// verified-correct reading on its own.
const AUTO_RESOLVED: [title: string, expectedReading: string][] = [
  ['進撃の巨人', 'シンゲキノキョジン'],
  ['五等分の花嫁', 'ゴトウブンノハナヨメ'],
  ['薬屋のひとりごと', 'クスリヤノヒトリゴト'],
  ['転生したらスライムだった件', 'テンセイシタラスライムダッタケン'],
  ['東京卍リベンジャーズ', 'トウキョウマンジリベンジャーズ'],
  ['キングダム', 'キングダム'],
  ['ゴールデンカムイ', 'ゴールデンカムイ'],
  ['約束のネバーランド', 'ヤクソクノネバーランド'],
  ['3月のライオン', 'サンガツノライオン'],
  ['2月の勝者', 'ニガツノショウシャ'],
  ['七つの大罪', 'ナナツノダイザイ'],
  ['かがみの孤城', 'カガミノコジョウ'],
  ['一週間フレンズ。', 'イチシュウカンフレンズ'],
  ['とんがり帽子のアトリエ', 'トンガリボウシノアトリエ'],
  // へ is the direction particle here (pronounced "e"), not the syllable
  // "he" - see PARTICLE_PRONUNCIATION in kanaGenerator.ts.
  ['不滅のあなたへ', 'フメツノアナタエ'],
  ['ブルーロック', 'ブルーロック'],
  ['アンデッドアンラック', 'アンデッドアンラック'],
  ['怪獣8号', 'カイジュウハチゴウ'],
  ['ダンジョン飯', 'ダンジョンメシ'],
  ['葬送のフリーレン', 'ソウソウノフリーレン'],
  ['推しの子', 'オシノコ'],
  ['チェンソーマン', 'チェンソーマン'],
  ['ぼっち・ざ・ろっく!', 'ボッチザロック'],
  // は here is the topic particle (pronounced "wa"), not the syllable "ha" -
  // see PARTICLE_PRONUNCIATION in kanaGenerator.ts.
  ['恋は雨上がりのように', 'コイワアメアガリノヨウニ'],
  ['からかい上手の高木さん', 'カラカイジョウズノタカギサン'],
  ['ヲタクに恋は難しい', 'ヲタクニコイワムズカシイ'],
  ['コウノドリ', 'コウノドリ'],
  ['火の鳥', 'ヒノトリ'],
  ['ドラゴンボール', 'ドラゴンボール'],
  ['僕のヒーローアカデミア', 'ボクノヒーローアカデミア'],
  ['はたらく細胞', 'ハタラクサイボウ'],
  ['ちはやふる', 'チハヤフル'],
  ['やがて君になる', 'ヤガテキミニナル'],
  ['わたしの幸せな結婚', 'ワタシノシアワセナケッコン'],
  ['おおきく振りかぶって', 'オオキクフリカブッテ'],
  ['のだめカンタービレ', 'ノダメカンタービレ'],
  ['バクマン。', 'バクマン'],
  ['ハイキュー!!', 'ハイキュー'],
  ['テラフォーマーズ', 'テラフォーマーズ'],
  ['アオアシ', 'アオアシ'],
  ['エルフェンリート', 'エルフェンリート'],
  ['からくりサーカス', 'カラクリサーカス'],
  ['うえきの法則', 'ウエキノホウソク'],
  ['20世紀少年', 'ニジュウセイキショウネン'],
  ['暗殺教室', 'アンサツキョウシツ'],
  ['弱虫ペダル', 'ヨワムシペダル'],
  ['僕らはみんな河合荘', 'ボクラワミンナカワイソウ'],
  ['虫と歌', 'ムシトウタ'],
  ['神様はじめました', 'カミサマハジメマシタ'],
  ['人形の国', 'ニンギョウノクニ'],
  ['夏目友人帳', 'ナツメユウジンチョウ'],
  // 手品(てじな) is rendaku (品 alone reads しな, voiced to じな in
  // compound) - kuromoji has it as one dictionary entry so resolves correctly.
  ['手品先生', 'テジナセンセイ'],
  // ちょ/しゅ below are youon (small ゃゅょ fused with the preceding kana).
  ['ちょっと今から仕事やめてくる', 'チョットイマカラシゴトヤメテクル'],
  ['しゅごキャラ!', 'シュゴキャラ'],
  ['鬼灯の冷徹', 'ホオズキノレイテツ'],
]

// UNRESOLVED group: titles kuromoji cannot confidently convert (stylized
// Latin spellings with no phonetic relationship to their real Japanese
// reading, or kanji outside the dictionary) - generateKanaReading must
// return null for these rather than guess, per its documented contract.
const UNRESOLVED: string[] = ['ONE PIECE', 'BLEACH', 'NARUTO', 'GANTZ', 'magi', '灼眼のシャナ', '聲の形']

// MANUAL group: real titles kuromoji's general-purpose dictionary resolves
// to a plausible-looking but factually wrong reading (proper-noun
// compounds/gikun wordplay outside any dictionary's reach) - exactly the
// case the wishlist's manual "読み仮名" override field (WishlistFormScreen)
// exists for. Verified here as compareByKana input with the override
// supplied directly, since that's what the UI passes once a user corrects it.
const MANUAL_OVERRIDE: [title: string, correctReading: string][] = [
  ['鬼滅の刃', 'キメツノヤイバ'],
  ['かぐや様は告らせたい', 'カグヤサマハコクラセタイ'],
  ['その着せ替え人形は恋をする', 'ソノビスクドールハコイヲスル'],
  ['赤髪の白雪姫', 'アカガミノシラユキヒメ'],
]

describe('generateKanaReading', () => {
  it.each(AUTO_RESOLVED)('resolves %s to %s', async (title, expected) => {
    expect(await generateKanaReading(title)).toBe(expected)
  })

  it.each(UNRESOLVED)('leaves %s unresolved (null)', async (title) => {
    expect(await generateKanaReading(title)).toBeNull()
  })
})

describe('full wishlist sort (generation + manual override + fallback, end to end)', () => {
  let entries: { name: string; kanaReading?: string }[]

  beforeAll(async () => {
    const generated = await Promise.all(
      AUTO_RESOLVED.map(async ([title]) => ({ name: title, kanaReading: (await generateKanaReading(title)) ?? undefined })),
    )
    const manual = MANUAL_OVERRIDE.map(([title, reading]) => ({ name: title, kanaReading: reading }))
    const unresolved = UNRESOLVED.map((title) => ({ name: title, kanaReading: undefined }))
    entries = [...generated, ...manual, ...unresolved]
  }, 30000)

  it('sorts the full 66-title list into exact 50-on order', () => {
    const sorted = [...entries].sort(compareByKana).map((e) => e.name)

    const expectedBucket0 = [...AUTO_RESOLVED.map(([t]) => t), ...MANUAL_OVERRIDE.map(([t]) => t)]
      .map((title) => {
        const reading =
          AUTO_RESOLVED.find(([t]) => t === title)?.[1] ?? MANUAL_OVERRIDE.find(([t]) => t === title)?.[1] ?? ''
        return { title, reading }
      })
      .sort((a, b) => new Intl.Collator('ja').compare(a.reading, b.reading))
      .map((e) => e.title)

    const expectedBucket1 = [...UNRESOLVED].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

    expect(sorted).toEqual([...expectedBucket0, ...expectedBucket1])
  })
})
