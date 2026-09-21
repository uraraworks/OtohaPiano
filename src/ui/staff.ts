// 五線の描画。
//
// 音部記号は SVG のパスで描く。Unicode の音楽記号(𝄞 U+1D11E)は端末に
// フォントが無いと豆腐になるし、記号用のフォントを読み込むのは
// 「完全静的・外部依存なし」に反する。自前で描けば、どの端末でも同じ形が出る。
//
// 図形の位置はすべて「段」(五線のいちばん下の線を 0 とし、線と線の間も 1 段)で
// 考える。core/staff.ts の計算をそのまま座標に写すだけにして、
// 描画側で音楽の理屈を持たないようにしてある。

import { staffStep, ledgerSteps, needsSharp, clefFor, type Clef } from "../core/staff.ts";

/** 線と線の間隔(px)。1 段はこの半分。 */
const GAP = 12;
const HALF = GAP / 2;
/** いちばん下の線の y 座標。 */
const BASE_Y = 78;
/** 音符を置く x 座標。 */
const NOTE_X = 74;
const WIDTH = 140;
const HEIGHT = 120;

function yOf(step: number): number {
  return BASE_Y - step * HALF;
}

// 音部記号は出さない。
//
// 描画は 2 度作り直しても記号として通用する形にならず、文字で「ト音記号」と
// 書く案も試したが、五線の脇に文字が入るのは読みにくいだけだった。
// このドリルで問うているのは音符の高さの位置であって記号の判別ではないので、
// 出さないことにしてある。

/** ♯。黒鍵のときだけ音符の前に付ける。 */
function sharp(x: number, y: number): string {
  return `<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <line x1="${x - 4}" y1="${y - 8}" x2="${x - 4}" y2="${y + 6}" />
    <line x1="${x + 2}" y1="${y - 10}" x2="${x + 2}" y2="${y + 4}" />
    <line x1="${x - 8}" y1="${y - 2}" x2="${x + 6}" y2="${y - 4}" />
    <line x1="${x - 8}" y1="${y + 4}" x2="${x + 6}" y2="${y + 2}" />
  </g>`;
}

/**
 * 音符 1 つぶん(和音なら重ねて)の五線を描いた SVG を返す。
 * @param midis 鳴っている音。和音は同じ五線に重ねる。
 * @param baseMidi 出題の起点(ド)。音部記号を決めるのに使う。
 */
export function renderStaff(midis: number[], baseMidi: number): string {
  const clef: Clef = clefFor(baseMidi);
  const parts: string[] = [];

  // 五線。
  for (let i = 0; i < 5; i++) {
    const y = yOf(i * 2);
    parts.push(
      `<line x1="14" y1="${y}" x2="${WIDTH - 10}" y2="${y}" stroke="currentColor" stroke-width="1.4" opacity="0.75" />`,
    );
  }


  // 加線は和音のどの音にも要るぶんをまとめて 1 回だけ引く。
  const ledgers = new Set<number>();
  for (const midi of midis) {
    for (const s of ledgerSteps(staffStep(midi, clef))) ledgers.add(s);
  }
  for (const s of ledgers) {
    const y = yOf(s);
    parts.push(
      `<line x1="${NOTE_X - 14}" y1="${y}" x2="${NOTE_X + 14}" y2="${y}" stroke="currentColor" stroke-width="1.4" />`,
    );
  }

  for (const midi of midis) {
    const step = staffStep(midi, clef);
    const y = yOf(step);
    // 符頭は少し傾けた楕円。まっすぐだと線に埋もれて見える。
    parts.push(
      `<ellipse cx="${NOTE_X}" cy="${y}" rx="7.5" ry="5.6" fill="currentColor" transform="rotate(-18 ${NOTE_X} ${y})" />`,
    );
    // 符幹。真ん中の線より上なら下向き、下なら上向き(通常の書き方)。
    const up = step < 4;
    parts.push(
      up
        ? `<line x1="${NOTE_X + 7}" y1="${y}" x2="${NOTE_X + 7}" y2="${y - 32}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />`
        : `<line x1="${NOTE_X - 7}" y1="${y}" x2="${NOTE_X - 7}" y2="${y + 32}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />`,
    );
    if (needsSharp(midi)) parts.push(sharp(NOTE_X - 18, y));
  }

  // viewBox だけだと SVG に内在サイズが無く、Safari は width: auto を 0 に
  // してしまう（幅を決める手がかりが無いため）。実表示サイズは CSS 側で
  // 上書きするが、ここでも内在サイズとして width/height を持たせておく。
  return `<svg class="staff-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="音符">${parts.join("")}</svg>`;
}
