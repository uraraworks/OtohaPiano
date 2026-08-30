import { describe, it, expect } from "vitest";
import { midiForKey, mappedKeyCount, shouldPlayKey } from "../src/core/keyMap.ts";
import { noteNameJa, isBlackKey } from "../src/core/notes.ts";

const C4 = 60;

describe("パソコンのキーの対応", () => {
  it("ホームポジションの段が ド から ソ まで並ぶ", () => {
    const row = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "BracketRight"];
    const names = row.map((code) => noteNameJa(midiForKey(code, C4)!));
    expect(names).toEqual(["ド", "レ", "ミ", "ファ", "ソ", "ラ", "シ", "ド", "レ", "ミ", "ファ", "ソ"]);
  });

  it("ホームポジションの段はすべて白鍵", () => {
    const row = ["KeyA", "KeyS", "KeyD", "KeyF", "KeyG", "KeyH", "KeyJ", "KeyK", "KeyL", "Semicolon", "Quote", "BracketRight"];
    for (const code of row) expect(isBlackKey(midiForKey(code, C4)!)).toBe(false);
  });

  it("上の段はすべて黒鍵", () => {
    const row = ["KeyW", "KeyE", "KeyT", "KeyY", "KeyU", "KeyO", "KeyP", "BracketLeft"];
    for (const code of row) expect(isBlackKey(midiForKey(code, C4)!)).toBe(true);
  });

  it("黒鍵の無いところ（ミとファの間・シとドの間）は割り当てない", () => {
    // R と I を飛ばしてあるので、上の段の並びが鍵盤の見た目と重なる。
    expect(midiForKey("KeyR", C4)).toBeNull();
    expect(midiForKey("KeyI", C4)).toBeNull();
  });

  it("鍵盤の左端を動かすと、鳴る音も一緒に動く", () => {
    expect(midiForKey("KeyA", C4 + 12)).toBe(C4 + 12);
    expect(midiForKey("KeyG", C4 + 12)).toBe(C4 + 19);
  });

  it("割り当ての無いキーは null", () => {
    expect(midiForKey("Space", C4)).toBeNull();
    expect(midiForKey("KeyZ", C4)).toBeNull();
    expect(midiForKey("Enter", C4)).toBeNull();
  });

  it("白鍵 12 個と黒鍵 8 個", () => {
    expect(mappedKeyCount()).toBe(20);
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
