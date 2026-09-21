// 五線のどこに音符を置くかの計算。
//
// 五線は「半音」ではなく「白鍵の並び」で場所が決まる(ドとレの間もミとファの間も
// 五線の上では同じ 1 段)。したがって notes.ts の whiteIndexOf がそのまま使える。
// 黒鍵は直前の白鍵と同じ場所に置き、♯ を前に付ける。
//
// 音部記号は出題の起点(ド)に合わせて選ぶ。鍵盤はファ始まりで表示するが、
// おとあての出題は必ずドから数えるので、五線の記号選びもそのドを基準にする。

import { whiteIndexOf, isBlackKey } from "./notes.ts";

export type Clef = "treble" | "bass";

/** 五線のいちばん下の線にあたる音。ト音記号は E4、ヘ音記号は G2。 */
const BOTTOM_LINE: Record<Clef, number> = { treble: 64, bass: 43 };

/** 五線は 5 本。いちばん下の線を 0 として、線と線の間も 1 段と数える(上の線は 8)。 */
export const TOP_LINE_STEP = 8;

/**
 * どちらの音部記号を使うか決める。
 * baseMidi は出題の起点(必ずド。鍵盤の見た目の左端ではない)。
 * しきい値は中央のド(60)。これより下のドが起点ならヘ音記号、
 * 60 以上ならト音記号にすると、いちばん低い出題(中央のド)がト音記号の五線の下
 * 加線 1 本の上に来て、いちばん教わりやすい位置になる。
 */
export function clefFor(baseMidi: number): Clef {
  return baseMidi >= 60 ? "treble" : "bass";
}

/**
 * いちばん下の線から数えて何段上か。
 * 線の上なら偶数、線と線の間なら奇数。負なら五線の下。
 */
export function staffStep(midi: number, clef: Clef): number {
  return whiteIndexOf(midi) - whiteIndexOf(BOTTOM_LINE[clef]);
}

/** その音に ♯ が要るか(黒鍵は直前の白鍵の場所に ♯ を付けて表す)。 */
export function needsSharp(midi: number): boolean {
  return isBlackKey(midi);
}

/**
 * 音符を五線の外に置くときに要る加線の位置。
 * 五線の中に収まっていれば空。
 * @returns 段の番号の並び(線なので必ず偶数)。
 */
export function ledgerSteps(step: number): number[] {
  const out: number[] = [];
  if (step < 0) {
    // 下へ。-2, -4, … と、音符の段に届くまで引く。
    for (let s = -2; s >= step; s -= 2) out.push(s);
  } else if (step > TOP_LINE_STEP) {
    for (let s = TOP_LINE_STEP + 2; s <= step; s += 2) out.push(s);
  }
  return out;
}
