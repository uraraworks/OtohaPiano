import { describe, it, expect } from "vitest";
import { clefFor, staffStep, ledgerSteps, needsSharp, TOP_LINE_STEP } from "../src/core/staff.ts";

describe("音部記号のえらび方", () => {
  it("鍵盤の左端が F3 以上ならト音記号、それより下ならヘ音記号", () => {
    expect(clefFor(60)).toBe("treble");
    expect(clefFor(72)).toBe("treble");
    expect(clefFor(48)).toBe("bass");
    expect(clefFor(53)).toBe("treble");
  });
});

describe("五線の位置", () => {
  it("ト音記号: いちばん下の線は ミ(E4)", () => {
    expect(staffStep(64, "treble")).toBe(0);
  });

  it("ト音記号: 中央のド(C4)は五線の下、1 本の加線の上", () => {
    expect(staffStep(60, "treble")).toBe(-2);
    expect(ledgerSteps(-2)).toEqual([-2]);
  });

  it("ト音記号: いちばん上の線は ファ(F5)", () => {
    expect(staffStep(77, "treble")).toBe(TOP_LINE_STEP);
    expect(ledgerSteps(TOP_LINE_STEP)).toEqual([]);
  });

  it("ヘ音記号: いちばん下の線は ソ(G2)、いちばん上は ラ(A3)", () => {
    expect(staffStep(43, "bass")).toBe(0);
    expect(staffStep(57, "bass")).toBe(TOP_LINE_STEP);
  });

  it("となりの白鍵どうしは必ず 1 段ちがう（半音の幅は関係しない）", () => {
    // ミ→ファ は半音、ド→レ は全音だが、五線の上ではどちらも 1 段。
    expect(staffStep(65, "treble") - staffStep(64, "treble")).toBe(1);
    expect(staffStep(62, "treble") - staffStep(60, "treble")).toBe(1);
  });

  it("1 オクターブで 7 段ちがう", () => {
    expect(staffStep(72, "treble") - staffStep(60, "treble")).toBe(7);
  });

  it("黒鍵は直前の白鍵と同じ場所で、♯ が付く", () => {
    expect(staffStep(61, "treble")).toBe(staffStep(60, "treble"));
    expect(needsSharp(61)).toBe(true);
    expect(needsSharp(60)).toBe(false);
  });
});

describe("加線", () => {
  it("五線の中なら要らない", () => {
    for (let s = 0; s <= TOP_LINE_STEP; s++) expect(ledgerSteps(s)).toEqual([]);
  });

  it("下は -2 から音符の段まで", () => {
    expect(ledgerSteps(-1)).toEqual([]); // いちばん下の線のすぐ下(間)には要らない
    expect(ledgerSteps(-2)).toEqual([-2]);
    expect(ledgerSteps(-4)).toEqual([-2, -4]);
    expect(ledgerSteps(-5)).toEqual([-2, -4]);
  });

  it("上はいちばん上の線の次から", () => {
    expect(ledgerSteps(9)).toEqual([]);
    expect(ledgerSteps(10)).toEqual([10]);
    expect(ledgerSteps(12)).toEqual([10, 12]);
  });

  it("ドリルの範囲（左端のドから 1 オクターブ）では加線は 2 本まで", () => {
    // ト音記号・C4 始まりの場合。C4(-2) から C5(5) まで。
    for (let midi = 60; midi <= 72; midi++) {
      expect(ledgerSteps(staffStep(midi, "treble")).length).toBeLessThanOrEqual(2);
    }
    // ヘ音記号・C3 始まりの場合。
    for (let midi = 48; midi <= 60; midi++) {
      expect(ledgerSteps(staffStep(midi, "bass")).length).toBeLessThanOrEqual(2);
    }
  });
});
