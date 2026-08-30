import { describe, it, expect } from "vitest";
import { buildDoremi, activeIndex, toPrintableText } from "../src/core/doremi.ts";
import type { NoteEvent } from "../src/core/takes.ts";

describe("buildDoremi", () => {
  it("単音は 1 つずつ音名になる", () => {
    const events: NoteEvent[] = [
      { midi: 60, at: 0, dur: 0.4 },
      { midi: 62, at: 1, dur: 0.4 },
    ];
    expect(buildDoremi(events).map((i) => i.text)).toEqual(["ド", "レ"]);
  });

  it("ほぼ同時の打鍵は 1 つの和音にまとまり、低い音から並ぶ", () => {
    // 人の演奏は完全に同時にならない。数十ミリ秒のずれは和音として扱う。
    const events: NoteEvent[] = [
      { midi: 67, at: 1.0, dur: 0.5 },
      { midi: 60, at: 1.02, dur: 0.5 },
      { midi: 64, at: 1.04, dur: 0.5 },
    ];
    const items = buildDoremi(events);
    expect(items).toHaveLength(1);
    expect(items[0]!.text).toBe("ドミソ");
    expect(items[0]!.en).toBe("C4 E4 G4");
  });

  it("和音の幅を超えて離れていれば別々になる", () => {
    const events: NoteEvent[] = [
      { midi: 60, at: 1.0, dur: 0.5 },
      { midi: 64, at: 1.5, dur: 0.5 },
    ];
    expect(buildDoremi(events)).toHaveLength(2);
  });

  it("空なら空", () => {
    expect(buildDoremi([])).toEqual([]);
  });
});

describe("activeIndex", () => {
  const items = buildDoremi([
    { midi: 60, at: 1, dur: 0.2 },
    { midi: 62, at: 2, dur: 0.2 },
  ]);

  it("最初の音の前は -1", () => {
    expect(activeIndex(items, 0.5)).toBe(-1);
  });

  it("音の隙間では直前の音を指し続ける(見失わせない)", () => {
    expect(activeIndex(items, 1.5)).toBe(0);
    expect(activeIndex(items, 99)).toBe(1);
  });
});

describe("toPrintableText", () => {
  it("指定した数で折り返す", () => {
    const items = buildDoremi(
      [60, 62, 64, 65].map((midi, i) => ({ midi, at: i, dur: 0.2 })),
    );
    expect(toPrintableText(items, 2).split("\n")).toHaveLength(2);
  });
});
