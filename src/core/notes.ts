// 音名と鍵盤の並びに関する純粋ロジック。
// 音の高さは MIDI ノート番号(中央のド = 60)だけで表し、
// 「ドレミ」も「C4」も周波数も、すべてここから導出する。
// UI と音源の双方がこの 1 つの尺度を共有することで、
// 打鍵記録 → 光る鍵盤 → ドレミ表示が同じ数値で繋がる。

/** 半音 12 個ぶんの英語音名。index は MIDI 番号 % 12。 */
const PITCH_NAMES_EN = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/** 同じ並びの日本語音名(ふりがな UI とドレミ表示で使う)。 */
const PITCH_NAMES_JA = [
  "ド", "ド♯", "レ", "レ♯", "ミ", "ファ", "ファ♯", "ソ", "ソ♯", "ラ", "ラ♯", "シ",
] as const;

/** その半音が黒鍵かどうか。index は MIDI 番号 % 12。 */
const IS_BLACK = [
  false, true, false, true, false, false, true, false, true, false, true, false,
] as const;

export const MIDI_MIN = 21; // A0
export const MIDI_MAX = 108; // C8

/** 中央のド。オクターブ移動の基準点。 */
export const MIDI_MIDDLE_C = 60;

/** 鍵盤の左端の初期位置。F3。ここから白鍵 14 個で、中央のドが真ん中あたりに来る。 */
export const MIDI_DEFAULT_START = 53;

export function isBlackKey(midi: number): boolean {
  return IS_BLACK[((midi % 12) + 12) % 12]!;
}

/** MIDI 番号 → "C4" 形式。オクターブ番号は科学的表記(中央のドが C4)。 */
export function noteNameEn(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${PITCH_NAMES_EN[pc]}${octave}`;
}

/** MIDI 番号 → "ド" 形式。オクターブは付けない(子供が読む前提の表示)。 */
export function noteNameJa(midi: number): string {
  return PITCH_NAMES_JA[((midi % 12) + 12) % 12]!;
}

/** MIDI 番号 → 周波数(Hz)。A4 = 440Hz 基準の 12 平均律。 */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 白鍵だけを下から数えた通し番号。
 * 鍵盤を描くとき、白鍵は等間隔に並べ、黒鍵はこの番号の隙間に置く。
 * 白鍵でない MIDI 番号には「直前の白鍵の番号」を返す(黒鍵の位置決めに使う)。
 */
export function whiteIndexOf(midi: number): number {
  // C を 0 とした 1 オクターブ内の白鍵通し番号。黒鍵は直前の白鍵と同じ値。
  const table = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12);
  return octave * 7 + table[pc]!;
}

export interface KeyLayoutItem {
  midi: number;
  black: boolean;
  /** 白鍵なら左から何番目か。黒鍵なら「直前の白鍵の番号」(＝またがる位置)。 */
  whiteIndex: number;
}

/**
 * 開始 MIDI 番号から白鍵 whiteCount 個ぶんの鍵盤の並びを作る。
 * 返す whiteIndex は 0 起点(＝画面左端が 0)に正規化済み。
 * 描画順の都合で白鍵をすべて先に、黒鍵を後に並べる(黒鍵は白鍵の上に重ねる)。
 */
export function buildKeyLayout(startMidi: number, whiteCount: number): KeyLayoutItem[] {
  const base = whiteIndexOf(startMidi);
  const white: KeyLayoutItem[] = [];
  const black: KeyLayoutItem[] = [];
  for (let midi = startMidi; midi <= MIDI_MAX; midi++) {
    const wi = whiteIndexOf(midi) - base;
    if (wi >= whiteCount) break;
    const item: KeyLayoutItem = { midi, black: isBlackKey(midi), whiteIndex: wi };
    (item.black ? black : white).push(item);
  }
  return [...white, ...black];
}

/**
 * 鍵盤の左端に置ける最も低い ファ。
 * オクターブ移動ボタンはこの一覧の上を動くだけにして、
 * 「ファで始まらない鍵盤」が出ないようにする。
 * アンパンマンピアノ等、子供向けピアノはファ始まりが多いので、それに合わせてある。
 */
export function octaveStartCandidates(whiteCount: number): number[] {
  const out: number[] = [];
  for (let f = 29; f <= 89; f += 12) {
    // その ファ から白鍵 whiteCount 個ぶんが MIDI_MAX に収まるか
    const lastWhite = whiteIndexOf(f) + whiteCount - 1;
    let fits = false;
    for (let m = f; m <= MIDI_MAX; m++) {
      if (!isBlackKey(m) && whiteIndexOf(m) === lastWhite) { fits = true; break; }
    }
    if (fits) out.push(f);
  }
  return out;
}

/**
 * startMidi(白鍵)から数えて n 番目(0 起点)の白鍵の MIDI 番号。
 * 左端が ド でなくても「左から n 番目の白鍵」が求まる。
 */
export function whiteKeyFrom(startMidi: number, n: number): number {
  let midi = startMidi;
  for (let left = n; left > 0; left--) {
    do { midi++; } while (isBlackKey(midi));
  }
  return midi;
}
