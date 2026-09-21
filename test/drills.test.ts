import { describe, it, expect } from "vitest";
import { RANGE_OPTIONS, CHORD_OPTIONS, poolSizeOf, makeDrillSteps } from "../src/core/drills.ts";
import { noteNameJa } from "../src/core/notes.ts";

const C4 = 60;
/** 値を順に返す、決まった乱数の代わり。 */
const seq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length]!;
};

describe("はんい", () => {
  it("「ぜんぶ」は画面に出ている鍵盤に従う", () => {
    const all = RANGE_OPTIONS.find((r) => r.id === "rall")!;
    expect(poolSizeOf(all, 14)).toBe(14);
    expect(poolSizeOf(all, 21)).toBe(21);
  });

  it("画面に出ている鍵盤より多くは使わない", () => {
    // 鍵盤を狭く(白鍵 3 個)しているのに「5つ」を選んでも、画面に無い鍵は出さない。
    const five = RANGE_OPTIONS.find((r) => r.id === "r5")!;
    expect(poolSizeOf(five, 3)).toBe(3);
  });

  it("えらんだ数ぶんだけ使う", () => {
    expect(poolSizeOf(RANGE_OPTIONS[0]!, 14)).toBe(3);
    expect(poolSizeOf(RANGE_OPTIONS[1]!, 14)).toBe(5);
  });
});

describe("出題", () => {
  it("指定した手数を作る", () => {
    const steps = makeDrillSteps({
      baseMidi: C4, poolSize: 5, chordMax: 1, count: 8, rng: seq([0.1, 0.9, 0.5, 0.3]),
    });
    expect(steps).toHaveLength(8);
  });

  it("はんい 3つ なら ドレミ しか出ない", () => {
    const steps = makeDrillSteps({
      baseMidi: C4, poolSize: 3, chordMax: 1, count: 30, rng: seq([0.05, 0.4, 0.75, 0.99, 0.2]),
    });
    for (const midi of steps.flat()) {
      expect(["ド", "レ", "ミ"]).toContain(noteNameJa(midi));
    }
  });

  it("いちどに 1つ なら必ず単音", () => {
    const steps = makeDrillSteps({
      baseMidi: C4, poolSize: 8, chordMax: 1, count: 30, rng: seq([0.9, 0.1, 0.5]),
    });
    expect(steps.every((s) => s.length === 1)).toBe(true);
  });

  it("いちどに 3つ なら 1〜3 個の手が出る（上限を超えない）", () => {
    const steps = makeDrillSteps({
      baseMidi: C4, poolSize: 8, chordMax: 3, count: 40, rng: seq([0.05, 0.4, 0.99, 0.6, 0.2, 0.8]),
    });
    const sizes = new Set(steps.map((s) => s.length));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(3);
    expect(sizes.size).toBeGreaterThan(1);
  });

  it("同時に鳴る音は重複しない", () => {
    const steps = makeDrillSteps({
      baseMidi: C4, poolSize: 5, chordMax: 3, count: 40, rng: seq([0.99, 0.2, 0.7, 0.1]),
    });
    for (const s of steps) expect(new Set(s).size).toBe(s.length);
  });

  it("同時に鳴る音は低い順に並ぶ（表示も判定もこの順に頼る）", () => {
    const steps = makeDrillSteps({
      baseMidi: C4, poolSize: 8, chordMax: 3, count: 30, rng: seq([0.8, 0.9, 0.1, 0.5, 0.3]),
    });
    for (const s of steps) expect(s).toEqual([...s].sort((a, b) => a - b));
  });

  it("はんいより多い音数を求められても、はんいの中で収める", () => {
    // ドレミの 3 音しか無いところで「いちどに 5つ」は作れない。
    const steps = makeDrillSteps({
      baseMidi: C4, poolSize: 3, chordMax: 5, count: 20, rng: seq([0.99, 0.5, 0.1]),
    });
    for (const s of steps) expect(s.length).toBeLessThanOrEqual(3);
  });

  it("鍵盤の位置を動かすと、出題もその位置から作られる", () => {
    const mk = (base: number) =>
      makeDrillSteps({ baseMidi: base, poolSize: 5, chordMax: 1, count: 5, rng: seq([0.1, 0.9]) });
    expect(mk(C4 + 12).flat()).toEqual(mk(C4).flat().map((m) => m + 12));
  });

  it("同じ手は続けて出さない", () => {
    // 常に同じ手を引く乱数でも引き直しが走る(引き直しても同じなら諦める)。
    const steps = makeDrillSteps({ baseMidi: C4, poolSize: 5, chordMax: 1, count: 6, rng: () => 0 });
    expect(steps).toHaveLength(6);
  });

  it("えらべる同時発音数は 1〜3", () => {
    expect([...CHORD_OPTIONS]).toEqual([1, 2, 3]);
  });

  it("左端が ファ のとき、はんい 3つ なら ファ・ソ・ラ しか出ない", () => {
    const steps = makeDrillSteps({
      baseMidi: 53, poolSize: 3, chordMax: 1, count: 30, rng: seq([0.05, 0.4, 0.75, 0.99, 0.2]),
    });
    for (const midi of steps.flat()) {
      expect(["ファ", "ソ", "ラ"]).toContain(noteNameJa(midi));
    }
  });
});
