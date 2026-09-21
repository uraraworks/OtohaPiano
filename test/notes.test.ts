import { describe, it, expect } from "vitest";
import {
  isBlackKey,
  noteNameEn,
  noteNameJa,
  midiToFreq,
  whiteIndexOf,
  buildKeyLayout,
  octaveStartCandidates,
  whiteKeyFrom,
  firstCFrom,
} from "../src/core/notes.ts";

describe("音名", () => {
  it("中央のドは C4 / ド", () => {
    expect(noteNameEn(60)).toBe("C4");
    expect(noteNameJa(60)).toBe("ド");
    expect(noteNameEn(69)).toBe("A4");
  });

  it("黒鍵の判定", () => {
    expect(isBlackKey(60)).toBe(false); // C
    expect(isBlackKey(61)).toBe(true); // C#
    expect(isBlackKey(64)).toBe(false); // E
    expect(isBlackKey(65)).toBe(false); // F(E の隣に黒鍵は無い)
  });

  it("A4 = 440Hz、1 オクターブで倍", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
  });
});

describe("鍵盤の並び", () => {
  it("白鍵の通し番号は 1 オクターブで 7 進む", () => {
    expect(whiteIndexOf(72) - whiteIndexOf(60)).toBe(7);
  });

  it("黒鍵は直前の白鍵と同じ番号を返す(またぐ位置の計算に使う)", () => {
    expect(whiteIndexOf(61)).toBe(whiteIndexOf(60));
  });

  it("C4 から白鍵 14 個 = 2 オクターブぶん、黒鍵は 10 枚", () => {
    const layout = buildKeyLayout(60, 14);
    expect(layout.filter((k) => !k.black)).toHaveLength(14);
    expect(layout.filter((k) => k.black)).toHaveLength(10);
    // whiteIndex は 0 起点に正規化されている
    expect(Math.min(...layout.map((k) => k.whiteIndex))).toBe(0);
    expect(Math.max(...layout.filter((k) => !k.black).map((k) => k.whiteIndex))).toBe(13);
  });

  it("白鍵を先に、黒鍵を後に並べる(黒鍵を上に重ねるため)", () => {
    const layout = buildKeyLayout(60, 14);
    const firstBlack = layout.findIndex((k) => k.black);
    expect(layout.slice(firstBlack).every((k) => k.black)).toBe(true);
  });

  it("左端の候補はすべて ファ", () => {
    for (const midi of octaveStartCandidates(14)) {
      expect(noteNameJa(midi)).toBe("ファ");
    }
  });
});

describe("左から n 番目の白鍵", () => {
  it("F3 起点で数える", () => {
    expect(whiteKeyFrom(53, 0)).toBe(53); // ファ
    expect(whiteKeyFrom(53, 1)).toBe(55); // ソ
    expect(whiteKeyFrom(53, 3)).toBe(59); // シ
    expect(whiteKeyFrom(53, 4)).toBe(60); // ド
    expect(whiteKeyFrom(53, 7)).toBe(65); // ファ(1 オクターブ上)
  });

  it("C 起点でも成り立つ(左端が ド でなくても白鍵は数えられる)", () => {
    expect(whiteKeyFrom(60, 2)).toBe(64);
  });
});

describe("以上でいちばん近い ド", () => {
  it("ド でなければ次のドまで進める", () => {
    expect(firstCFrom(53)).toBe(60); // F3 → C4
    expect(firstCFrom(41)).toBe(48); // F2 → C3
    expect(firstCFrom(89)).toBe(96); // F6 → C7
  });

  it("すでに ド ならそのまま", () => {
    expect(firstCFrom(60)).toBe(60);
  });
});
