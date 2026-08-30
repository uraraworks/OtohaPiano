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
const NOTE_X = 96;
const WIDTH = 140;
const HEIGHT = 120;

function yOf(step: number): number {
  return BASE_Y - step * HALF;
}

/**
 * 渦を計算で描く。
 * ベジエ曲線を手で合わせようとすると、渦の中心が狙った線に乗らない
 * （実際に乗らず、記号として意味をなさない形になった）。
 * 中心・半径・巻き数を数値で決めて点を並べれば、必ず狙った場所に乗る。
 */
function spiral(
  cx: number,
  cy: number,
  startR: number,
  endR: number,
  startAngleDeg: number,
  turns: number,
): string {
  const steps = 48;
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = ((startAngleDeg + t * turns * 360) * Math.PI) / 180;
    const r = startR + (endR - startR) * t;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    pts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

/**
 * ト音記号。
 * 「ト音（ソ）記号」の名のとおり、渦の中心がソの線に乗っていないと意味をなさない。
 * 位置は目分量ではなく、五線の段から計算した y に合わせてある。
 * 縦の軸（上の巻き〜しっぽ）と渦の 2 本に分けて描く。1 本で描こうとすると
 * 交差の具合をベジエで合わせることになり、狙った位置に乗らない。
 */
function trebleClef(): string {
  const gLine = yOf(2); // ソ(G4)の線。渦の中心
  const top = yOf(11); // 五線の上。上の巻きの先
  const tail = yOf(-4); // 五線の下。しっぽの先
  const cx = 42;
  const stroke = `fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`;

  // 上の巻きから、五線を貫いて、下のしっぽまで。
  // 上は左へ大きく張り出させ、下は右へ回してから左に引っかける。
  // まっすぐ下ろすと記号に見えず、ただの縦線になる。
  const stem = `M ${cx + 10} ${top}
    C ${cx - 18} ${top + 5}, ${cx - 20} ${top + 28}, ${cx - 2} ${gLine - 19}
    C ${cx + 12} ${gLine - 6}, ${cx + 11} ${gLine + 16}, ${cx + 3} ${tail - 9}
    c -2 8 -10 12 -16 7`;

  return `<path d="${stem}" ${stroke} />
    <path d="${spiral(cx, gLine, 16, 3, -45, 1.05)}" ${stroke} />`;
}

/** ヘ音記号。逆向きのかぎ形と、四線目をはさむ 2 つの点。 */
function bassClef(): string {
  const cy = yOf(6); // 4 本目の線(ファ)から描き始める
  return `<path d="
    M 30 ${cy - 4}
    c 8 -6 20 -2 20 8
    c 0 16 -16 26 -28 32"
    fill="none" stroke="currentColor" stroke-width="2.8"
    stroke-linecap="round" />
    <circle cx="56" cy="${cy - 6}" r="2.2" fill="currentColor" />
    <circle cx="56" cy="${cy + 6}" r="2.2" fill="currentColor" />`;
}

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
 * @param baseMidi 鍵盤の左端。音部記号を決めるのに使う。
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

  parts.push(clef === "treble" ? trebleClef() : bassClef());

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

  return `<svg class="staff-svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="音符">${parts.join("")}</svg>`;
}
