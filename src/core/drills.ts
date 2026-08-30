// 音と音名（ドレミ）の対応を覚えるドリル。
//
// 何をしないかを先に決めてある。
//   弾き方（運指・手の形・姿勢）には触れない。作っているのは資格を持つ人ではないので、
//   そこに踏み込むと妙なクセを付けかねない。教わるべきことは人から教わるのがよい。
//   一方「この音は ド だ」「ド はこの鍵だ」という対応は、誰から習っても同じ事実で、
//   間違った癖の付きようがない。ドリルはそこだけを扱う。
//
// 出題は規則から作る。曲を持たないので権利の判断が要らず、
// 範囲も長さも出題の中身も引数で変えられる。

/** 長調の音階を半音差で表したもの。ド=0 から 1 オクターブ上のド=12 まで。 */
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12] as const;

/** 音階の n 番目(0 起点)を半音差に直す。8 以上は 1 オクターブ上へ回す。 */
function deg(n: number): number {
  const octave = Math.floor(n / 7);
  const within = ((n % 7) + 7) % 7;
  return MAJOR[within]! + octave * 12;
}

export interface DrillLevel {
  id: string;
  name: string;
  /** どこまでの音が出るか。1 行で。 */
  aim: string;
  /** 使う音(音階上の番号)。 */
  pool: number[];
  /** 同時に鳴らす音の最大数。2 以上なら和音を混ぜる。 */
  maxChord: number;
}

export const DRILL_LEVELS: DrillLevel[] = [
  { id: "d3", name: "ドレミ", aim: "3 つの音から", pool: [0, 1, 2], maxChord: 1 },
  { id: "d5", name: "ドレミファソ", aim: "5 つの音から", pool: [0, 1, 2, 3, 4], maxChord: 1 },
  { id: "d8", name: "ドから ドまで", aim: "1 オクターブ・8 つの音から", pool: [0, 1, 2, 3, 4, 5, 6, 7], maxChord: 1 },
  {
    id: "dc",
    name: "かさなる音も",
    aim: "ときどき 2 つ同時に鳴る",
    pool: [0, 1, 2, 3, 4, 5, 6, 7],
    maxChord: 2,
  },
];

/**
 * 出題を作る。1 手 = 同時に鳴らす MIDI 番号の並び。
 * @param baseMidi 鍵盤の左端(ド)の MIDI 番号。画面に出ている鍵から作るので、
 *                 オクターブを動かしても出題が画面の外へ出ない。
 * @param rng 0 以上 1 未満を返す関数。テストから固定できるよう引数で受け取る
 *            (ここで Math.random を直接呼ぶと出題を検証できない)。
 */
export function makeDrillSteps(
  level: DrillLevel,
  count: number,
  baseMidi: number,
  rng: () => number,
): number[][] {
  const steps: number[][] = [];
  let prev: number | null = null;
  for (let i = 0; i < count; i++) {
    const pick = (): number => level.pool[Math.floor(rng() * level.pool.length)] ?? 0;
    let d = pick();
    // 同じ音が続くと、聞き分けずに前の答えを繰り返せてしまう。1 回だけ引き直す。
    if (d === prev) d = pick();
    prev = d;
    const degrees = [d];
    // 和音は 3 度上を重ねる。適当な 2 音より、耳に馴染む形にする。
    if (level.maxChord > 1 && rng() < 0.3) degrees.push(d + 2);
    steps.push(degrees.map((n) => baseMidi + deg(n)));
  }
  return steps;
}
