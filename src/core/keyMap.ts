// パソコンのキーボードで弾くための対応表。
//
// タブレットが主なので、これは大人向けの隠し機能。画面には出していない。
//
// キーの判定に event.key ではなく event.code を使う。code は「キーの物理的な位置」
// なので、押した場所と鳴る音が一対一で決まる。
//
// 割り当ては JIS 配列（日本語キーボード）の刻印に合わせてある。
// JIS では code と刻印の対応が US とずれていて、ここを取り違えると
// 「] が鳴らず、[ がソになる」ことになる（実際になった）。
//   JIS: ] = Backslash / [ = BracketRight / @ = BracketLeft / : = Quote
//   US : ] = BracketRight / [ = BracketLeft / ' = Quote
//
// 白鍵をホームポジションの段（ド から ソ まで 12 個）、黒鍵をその上の段に置く。
// ミとファの間、シとドの間には黒鍵が無いので、上の段もその位置を空ける
// （R・I・@ を飛ばす）。JIS ではキーの並びが鍵盤の見た目とそのまま重なる。
//
//   黒鍵     W E   T Y U   O P   [
//   白鍵    A S D F G H J K L ; : ]
//
// US 配列で使うと右端 2 つの刻印だけ変わる（] のかわりに \、[ のかわりに ]）。
// 位置は同じなので、指の動きは変わらない。

/** キーの物理位置 → 鍵盤の左端（ド）からの半音差。 */
const KEY_TO_SEMITONE: Record<string, number> = {
  // 白鍵。ド レ ミ ファ ソ ラ シ ド レ ミ ファ ソ
  KeyA: 0,
  KeyS: 2,
  KeyD: 4,
  KeyF: 5,
  KeyG: 7,
  KeyH: 9,
  KeyJ: 11,
  KeyK: 12,
  KeyL: 14,
  Semicolon: 16,
  Quote: 17,
  // JIS の「]」。US では Enter の上の「\」にあたる。
  Backslash: 19,
  // 黒鍵。
  KeyW: 1,
  KeyE: 3,
  KeyT: 6,
  KeyY: 8,
  KeyU: 10,
  KeyO: 13,
  KeyP: 15,
  // JIS の「[」。US では「]」にあたる。
  BracketRight: 18,
};

/**
 * キーの物理位置から、鍵盤の左端を基準にした MIDI 番号を求める。
 * @param code KeyboardEvent.code
 * @param baseMidi 鍵盤の左端（ド）の MIDI 番号
 * @returns 割り当てが無ければ null
 */
export function midiForKey(code: string, baseMidi: number): number | null {
  const semitone = KEY_TO_SEMITONE[code];
  return semitone === undefined ? null : baseMidi + semitone;
}

/** 割り当てのあるキーの数。 */
export function mappedKeyCount(): number {
  return Object.keys(KEY_TO_SEMITONE).length;
}

/**
 * この打鍵を鍵盤として扱ってよいか。
 * 文字を打ち込んでいる最中や、ショートカット（Ctrl+A など）を横取りしない。
 */
export function shouldPlayKey(event: {
  repeat: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}): boolean {
  // 押しっぱなしの自動連打は無視する。1 回の打鍵で 1 回だけ鳴らす。
  if (event.repeat) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const el = event.target as HTMLElement | null;
  if (!el) return true;
  const tag = el.tagName;
  // URL の入力中に鍵盤が鳴ると、貼り付けができない。
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return false;
  return !el.isContentEditable;
}
