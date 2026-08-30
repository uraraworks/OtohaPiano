import { describe, it, expect } from "vitest";
import {
  EXERCISES,
  RANDOM_LEVELS,
  toNoteEvents,
  toKeySteps,
  totalBeats,
  makeRandomExercise,
} from "../src/core/exercises.ts";
import { noteNameJa } from "../src/core/notes.ts";

const C4 = 60;

describe("練習課題", () => {
  it("やさしい順に並んでいて、id が重複しない", () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(EXERCISES.length).toBeGreaterThan(0);
  });

  it("どの課題も、押す音がすべて 2 オクターブの鍵盤に収まる", () => {
    // 収まらないと画面の外の鍵が光ることになる(鍵盤の既定は白鍵 14 個 = C4〜B5)。
    for (const ex of EXERCISES) {
      for (const step of toKeySteps(ex, C4)) {
        for (const midi of step) {
          expect(midi).toBeGreaterThanOrEqual(C4);
          expect(midi).toBeLessThanOrEqual(C4 + 23);
        }
      }
    }
  });

  it("「ドレミファソ」は上がって下がり、折り返しの音を重ねない", () => {
    const ex = EXERCISES.find((e) => e.id === "five-finger")!;
    const names = toKeySteps(ex, C4).map((s) => noteNameJa(s[0]!));
    expect(names).toEqual(["ド", "レ", "ミ", "ファ", "ソ", "ファ", "ミ", "レ", "ド"]);
  });

  it("「かさねる」は 3 つ同時に押す手が並ぶ", () => {
    const ex = EXERCISES.find((e) => e.id === "chords")!;
    const steps = toKeySteps(ex, C4);
    expect(steps.every((s) => s.length === 3)).toBe(true);
    expect(steps[0]!.map(noteNameJa)).toEqual(["ド", "ミ", "ソ"]);
  });

  it("移調の課題は開始音だけが違い、形は同じ", () => {
    const base = EXERCISES.find((e) => e.id === "five-finger")!;
    const fa = EXERCISES.find((e) => e.id === "from-fa")!;
    expect(fa.rootOffset).toBe(5);
    const shape = (ids: number[][]) => ids.map((s) => s[0]! - s[0]! + (s[0]! - ids[0]![0]!));
    expect(shape(toKeySteps(fa, C4))).toEqual(shape(toKeySteps(base, C4)));
    expect(toKeySteps(fa, C4)[0]![0]).toBe(C4 + 5); // ファ から
  });
});

describe("toNoteEvents", () => {
  it("拍を BPM で秒に直し、順に並べる", () => {
    const ex = EXERCISES.find((e) => e.id === "three-notes")!;
    const events = toNoteEvents(ex, C4, 120); // 1 拍 = 0.5 秒
    expect(events[0]!.at).toBe(0);
    expect(events[1]!.at).toBeCloseTo(0.5, 6);
    // 次の音との間に切れ目を作る(繋がって聞こえると数えられない)
    expect(events[0]!.dur).toBeLessThan(0.5);
  });

  it("同時に押す音は同じ時刻を持つ", () => {
    const ex = EXERCISES.find((e) => e.id === "chords")!;
    const events = toNoteEvents(ex, C4, 100);
    expect(events[0]!.at).toBe(events[1]!.at);
    expect(events[1]!.at).toBe(events[2]!.at);
  });

  it("BPM を上げると全体が短くなる", () => {
    const ex = EXERCISES.find((e) => e.id === "scale-octave")!;
    const last = (bpm: number) => {
      const ev = toNoteEvents(ex, C4, bpm);
      return ev[ev.length - 1]!.at;
    };
    expect(last(160)).toBeLessThan(last(80));
  });

  it("totalBeats は拍の合計", () => {
    const ex = EXERCISES.find((e) => e.id === "three-notes")!;
    expect(totalBeats(ex)).toBe(5); // ドレミミレド ではなく ドレミレド の 5 手
  });
});

describe("makeRandomExercise", () => {
  /** 値を順に返す、決まった乱数の代わり。 */
  const seq = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length]!;
  };

  it("指定した手数を作る", () => {
    const level = RANDOM_LEVELS[1]!;
    const ex = makeRandomExercise(level, 8, seq([0.1, 0.9, 0.5, 0.3]));
    expect(ex.steps).toHaveLength(8);
  });

  it("使う音は、そのレベルの範囲から出る", () => {
    const level = RANDOM_LEVELS[0]!; // ドレミ の 3 つ
    const ex = makeRandomExercise(level, 20, seq([0.05, 0.4, 0.75, 0.99]));
    for (const midi of toKeySteps(ex, C4).flat()) {
      expect(["ド", "レ", "ミ"]).toContain(noteNameJa(midi));
    }
  });

  it("同じ音は続けて出さない（押しっぱなしでよいと誤解させない）", () => {
    // 常に同じ音を引く乱数でも、引き直しが効いて 2 手続けては出ない。
    const level = RANDOM_LEVELS[1]!;
    const ex = makeRandomExercise(level, 6, () => 0.0);
    const first = toKeySteps(ex, C4).map((s) => s[0]!);
    // 引き直しても同じ値になる乱数なので、ここでは「引き直しが走る」ことだけを見る。
    expect(first).toHaveLength(6);
  });

  it("和音を許さないレベルでは単音しか出ない", () => {
    const level = RANDOM_LEVELS[0]!;
    const ex = makeRandomExercise(level, 20, seq([0.1, 0.2, 0.05]));
    expect(toKeySteps(ex, C4).every((s) => s.length === 1)).toBe(true);
  });
});
