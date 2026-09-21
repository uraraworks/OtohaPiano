// 音と音名（ドレミ）の対応を覚えるドリル。
//
// 何をしないかを先に決めてある。
//   弾き方（運指・手の形・姿勢）には触れない。作っているのは資格を持つ人ではないので、
//   そこに踏み込むと妙なクセを付けかねない。教わるべきことは人から教わるのがよい。
//   一方「この音は ド」「ド はこの鍵」という対応は、誰から習っても同じ事実で、
//   間違った癖の付きようがない。ドリルはそこだけを扱う。
//
// 出題は規則から作る。曲を持たないので権利の判断が要らず、
// 範囲も長さも出題の中身も引数で変えられる。
//
// 難しさは 2 つの軸に分けてある。混ぜると「何が難しくなったのか」が分からなくなる。
//   はんい   … 画面に出ている鍵盤の、左から何個ぶんを使うか
//   いちどに … 同時に鳴らす音を何個までにするか

import { whiteKeyFrom } from "./notes.ts";

export interface RangeOption {
  id: string;
  /** ボタンに出す文字。ふりがな(ruby)を含む。 */
  label: string;
  /** 何を選んだことになるか。1 行で。ふりがな(ruby)を含む。 */
  aim: string;
  /** 使う白鍵の数。"all" なら画面に出ている鍵盤ぶん全部。 */
  count: number | "all";
}

export const RANGE_OPTIONS: RangeOption[] = [
  { id: "r3", label: "3つ", aim: "<ruby>左<rt>ひだり</rt></ruby>から <ruby>白<rt>しろ</rt></ruby>い<ruby>鍵<rt>けん</rt></ruby> 3つ", count: 3 },
  { id: "r5", label: "5つ", aim: "<ruby>左<rt>ひだり</rt></ruby>から <ruby>白<rt>しろ</rt></ruby>い<ruby>鍵<rt>けん</rt></ruby> 5つ", count: 5 },
  { id: "rall", label: "<ruby>全部<rt>ぜんぶ</rt></ruby>", aim: "<ruby>見<rt>み</rt></ruby>えている <ruby>白<rt>しろ</rt></ruby>い<ruby>鍵<rt>けん</rt></ruby> <ruby>全部<rt>ぜんぶ</rt></ruby>", count: "all" },
];

/** 同時に鳴らす音の上限として選べる数。 */
export const CHORD_OPTIONS = [1, 2, 3] as const;

/**
 * 実際に使う白鍵の数を出す。
 * 「ぜんぶ」は画面に出ている鍵盤に従うので、鍵盤の広さを変えると出題も変わる。
 * 画面に無い鍵が答えになることは無い。
 */
export function poolSizeOf(range: RangeOption, visibleWhiteKeys: number): number {
  const n = range.count === "all" ? visibleWhiteKeys : range.count;
  return Math.max(1, Math.min(n, visibleWhiteKeys));
}

export interface DrillOptions {
  /** 鍵盤の左端の MIDI 番号。 */
  baseMidi: number;
  /** 使う白鍵の数。 */
  poolSize: number;
  /** 同時に鳴らす音の上限。1 なら必ず単音。 */
  chordMax: number;
  /** 何手ぶん作るか。 */
  count: number;
  /**
   * 0 以上 1 未満を返す関数。テストから固定できるよう引数で受け取る
   * (ここで Math.random を直接呼ぶと出題を検証できない)。
   */
  rng: () => number;
}

/**
 * 出題を作る。1 手 = 同時に押す MIDI 番号の並び。
 * 出題はすべて、画面に出ている鍵盤の白鍵から選ばれる。
 * 音の高さは「左端から数えた白鍵」で決める(長調の音階ではない)。
 * 左端がファだと C メジャーの半音差表には黒鍵(シ♭)が混ざってしまい、
 * 「左から白い鍵 n つ」という出題の建前が崩れるため。
 */
export function makeDrillSteps(opts: DrillOptions): number[][] {
  const { baseMidi, poolSize, chordMax, count, rng } = opts;
  const pool = Array.from({ length: Math.max(1, poolSize) }, (_, i) => i);
  const maxNotes = Math.max(1, Math.min(chordMax, pool.length));
  const steps: number[][] = [];
  let prev: string | null = null;

  for (let i = 0; i < count; i++) {
    const size = 1 + Math.floor(rng() * maxNotes);
    let degrees = pickDistinct(pool, size, rng);
    // 直前とまったく同じ手が続くと、聞き分けずに前の答えを繰り返せてしまう。
    // 1 回だけ引き直す(引き直しても同じなら諦める。無限に粘らない)。
    if (degrees.join(",") === prev) degrees = pickDistinct(pool, size, rng);
    prev = degrees.join(",");
    steps.push(degrees.map((n) => whiteKeyFrom(baseMidi, n)));
  }
  return steps;
}

/** pool から重複なく n 個選ぶ。低い音から並べて返す。 */
function pickDistinct(pool: number[], n: number, rng: () => number): number[] {
  const rest = [...pool];
  const out: number[] = [];
  for (let i = 0; i < n && rest.length > 0; i++) {
    const idx = Math.floor(rng() * rest.length);
    out.push(rest.splice(Math.min(idx, rest.length - 1), 1)[0]!);
  }
  return out.sort((a, b) => a - b);
}
