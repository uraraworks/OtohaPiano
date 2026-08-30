import { describe, it, expect } from "vitest";
import { DRILL_LEVELS, makeDrillSteps } from "../src/core/drills.ts";
import { noteNameJa } from "../src/core/notes.ts";

const C4 = 60;
/** 値を順に返す、決まった乱数の代わり。 */
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("ドリルの出題", () => {
  it("指定した手数を作る", () => {
    const steps = makeDrillSteps(DRILL_LEVELS[1]!, 8, C4, seq([0.1, 0.9, 0.5, 0.3]));
    expect(steps).toHaveLength(8);
  });

  it("使う音は、そのレベルの範囲から出る", () => {
    const level = DRILL_LEVELS[0]!; // ドレミ
    const steps = makeDrillSteps(level, 30, C4, seq([0.05, 0.4, 0.75, 0.99, 0.2]));
    for (const midi of steps.flat()) {
      expect(["ド", "レ", "ミ"]).toContain(noteNameJa(midi));
    }
  });

  it("1 オクターブのレベルは、鍵盤 2 オクターブに収まる", () => {
    // 収まらないと画面の外の鍵が答えになってしまう(鍵盤の既定は白鍵 14 個 = C4〜B5)。
    const steps = makeDrillSteps(DRILL_LEVELS[3]!, 50, C4, seq([0.99, 0.1, 0.29, 0.6]));
    for (const midi of steps.flat()) {
      expect(midi).toBeGreaterThanOrEqual(C4);
      expect(midi).toBeLessThanOrEqual(C4 + 23);
    }
  });

  it("和音を許さないレベルでは単音しか出ない", () => {
    const steps = makeDrillSteps(DRILL_LEVELS[0]!, 30, C4, seq([0.1, 0.2, 0.05]));
    expect(steps.every((s) => s.length === 1)).toBe(true);
  });

  it("和音のレベルでは 2 つ同時の手が混ざる", () => {
    // 和音の抽選(rng < 0.3)に当たる値を挟んだ乱数を与える。
    const steps = makeDrillSteps(DRILL_LEVELS[3]!, 20, C4, seq([0.5, 0.1]));
    expect(steps.some((s) => s.length === 2)).toBe(true);
  });

  it("鍵盤の位置を動かすと、出題もその位置から作られる", () => {
    const a = makeDrillSteps(DRILL_LEVELS[1]!, 5, C4, seq([0.1, 0.9]));
    const b = makeDrillSteps(DRILL_LEVELS[1]!, 5, C4 + 12, seq([0.1, 0.9]));
    expect(b.flat()).toEqual(a.flat().map((m) => m + 12));
  });

  it("同じ音は続けて出さない", () => {
    // 常に同じ音を引く乱数でも引き直しが走る(引き直しても同じ値なら諦める)。
    const steps = makeDrillSteps(DRILL_LEVELS[1]!, 6, C4, () => 0);
    expect(steps).toHaveLength(6);
  });
});
