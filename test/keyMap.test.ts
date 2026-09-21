import { describe, it, expect } from "vitest";
import { midiForKey, mappedKeyCount, shouldPlayKey } from "../src/core/keyMap.ts";
import { noteNameJa, isBlackKey } from "../src/core/notes.ts";

const F3 = 53;

describe("パソコンのキーの対応", () => {
  it("ホームポジションの段が ファ から ド まで並ぶ", () => {
    const row = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Backslash"];
    const names = row.map((code) => noteNameJa(midiForKey(code, F3)!));
    expect(names).toEqual(["ファ", "ソ", "ラ", "シ", "ド", "レ", "ミ", "ファ", "ソ", "ラ", "シ", "ド"]);
  });

  it("ホームポジションの段はすべて白鍵", () => {
    const row = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "Backslash"];
    for (const code of row) expect(isBlackKey(midiForKey(code, F3)!)).toBe(false);
  });

  it("上の段はすべて黒鍵", () => {
    const row = ["KeyW", "KeyE", "KeyR", "KeyY", "KeyU", "KeyO", "KeyP", "BracketLeft", "BracketRight"];
    for (const code of row) expect(isBlackKey(midiForKey(code, F3)!)).toBe(true);
  });

  it("黒鍵の無いところ（シとドの間・ミとファの間）は割り当てない", () => {
    // T と I を飛ばしてあるので、上の段の並びが鍵盤の見た目と重なる。
    expect(midiForKey("KeyT", F3)).toBeNull();
    expect(midiForKey("KeyI", F3)).toBeNull();
  });

  it("JIS の刻印どおりに鳴る", () => {
    // JIS では code と刻印の対応が US とずれる。ここを取り違えると
    // 「] が鳴らず、[ がソになる」ことになる（実際になった）。
    expect(noteNameJa(midiForKey("Backslash", F3)!)).toBe("ド"); // ]
    expect(noteNameJa(midiForKey("BracketLeft", F3)!)).toBe("ラ♯"); // @
    expect(noteNameJa(midiForKey("BracketRight", F3)!)).toBe("ド♯"); // [
  });

  it("右端の @ と [ は、はさむ白鍵の間の黒鍵になっている", () => {
    // @ は :(シ) の 1 つ下、[ は ](ド) の 1 つ上。
    expect(midiForKey("BracketLeft", F3)).toBe(midiForKey("Quote", F3)! - 1);
    expect(midiForKey("BracketRight", F3)).toBe(midiForKey("Backslash", F3)! + 1);
  });

  it("鍵盤の左端を動かすと、鳴る音も一緒に動く", () => {
    expect(midiForKey("KeyA", F3 + 12)).toBe(65);
    expect(midiForKey("KeyG", F3 + 12)).toBe(72);
  });

  it("割り当ての無いキーは null", () => {
    expect(midiForKey("Space", F3)).toBeNull();
    expect(midiForKey("KeyZ", F3)).toBeNull();
    expect(midiForKey("Enter", F3)).toBeNull();
  });

  it("白鍵 12 個と黒鍵 9 個", () => {
    expect(mappedKeyCount()).toBe(21);
  });
});

describe("鍵盤として扱ってよい打鍵か", () => {
  const base = { repeat: false, ctrlKey: false, metaKey: false, altKey: false, target: null };

  it("ふつうの打鍵は鳴らす", () => {
    expect(shouldPlayKey(base)).toBe(true);
  });

  it("押しっぱなしの自動連打は無視する", () => {
    expect(shouldPlayKey({ ...base, repeat: true })).toBe(false);
  });

  it("ショートカットは横取りしない", () => {
    expect(shouldPlayKey({ ...base, ctrlKey: true })).toBe(false);
    expect(shouldPlayKey({ ...base, metaKey: true })).toBe(false);
    expect(shouldPlayKey({ ...base, altKey: true })).toBe(false);
  });

  it("文字の入力中は鳴らさない（URL の貼り付けができなくなる）", () => {
    const input = { tagName: "INPUT", isContentEditable: false } as HTMLElement;
    expect(shouldPlayKey({ ...base, target: input })).toBe(false);
    const div = { tagName: "DIV", isContentEditable: false } as HTMLElement;
    expect(shouldPlayKey({ ...base, target: div })).toBe(true);
  });
});
