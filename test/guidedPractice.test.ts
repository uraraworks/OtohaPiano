import { describe, it, expect } from "vitest";
import { GuidedPractice } from "../src/core/guidedPractice.ts";

describe("GuidedPractice", () => {
  it("正しい鍵を押すと次へ進む", () => {
    const g = new GuidedPractice([[60], [62], [64]]);
    expect(g.current).toEqual([60]);
    expect(g.press(60)).toEqual({ kind: "advance", next: [62] });
    expect(g.current).toEqual([62]);
  });

  it("最後まで押し切ると終わる", () => {
    const g = new GuidedPractice([[60], [62]]);
    g.press(60);
    expect(g.press(62)).toEqual({ kind: "done" });
    expect(g.done).toBe(true);
  });

  it("ちがう鍵では進まない（待ち続ける）", () => {
    const g = new GuidedPractice([[60], [62]]);
    expect(g.press(65)).toEqual({ kind: "wrong" });
    expect(g.current).toEqual([60]);
    expect(g.missCount).toBe(1);
  });

  it("和音は同時でなくてよく、全部そろったら進む", () => {
    // 指が 1 本ずつ落ちるのが普通なので、同時押しは求めない。
    const g = new GuidedPractice([[60, 64, 67], [65]]);
    expect(g.press(60)).toEqual({ kind: "partial", remaining: [64, 67] });
    expect(g.press(67)).toEqual({ kind: "partial", remaining: [64] });
    expect(g.press(64)).toEqual({ kind: "advance", next: [65] });
  });

  it("光らせるのは、まだ押していない鍵だけ", () => {
    const g = new GuidedPractice([[60, 64]]);
    g.press(60);
    expect(g.remaining).toEqual([64]);
  });

  it("同じ鍵を二度押しても和音は完成しない", () => {
    const g = new GuidedPractice([[60, 64]]);
    g.press(60);
    expect(g.press(60)).toEqual({ kind: "partial", remaining: [64] });
  });

  it("進み具合を数える", () => {
    const g = new GuidedPractice([[60], [62], [64]]);
    expect(g.progress).toEqual({ step: 1, total: 3 });
    g.press(60);
    expect(g.progress).toEqual({ step: 2, total: 3 });
    g.press(62);
    g.press(64);
    expect(g.progress).toEqual({ step: 3, total: 3 });
  });

  it("やり直せる", () => {
    const g = new GuidedPractice([[60], [62]]);
    g.press(60);
    g.press(99);
    g.reset();
    expect(g.current).toEqual([60]);
    expect(g.missCount).toBe(0);
    expect(g.done).toBe(false);
  });

  it("空の手が混ざっても止まらない", () => {
    // 空の手を残すと永久に進まなくなる。作る側の取りこぼしを吸収する。
    const g = new GuidedPractice([[60], [], [62]]);
    expect(g.progress.total).toBe(2);
    g.press(60);
    expect(g.current).toEqual([62]);
  });

  it("手を継ぎ足せる（出題が尽きない練習のため）", () => {
    const g = new GuidedPractice([[60]]);
    expect(g.remainingSteps).toBe(1);
    g.append([[62], [64]]);
    expect(g.remainingSteps).toBe(3);
    g.press(60);
    expect(g.current).toEqual([62]);
    expect(g.done).toBe(false);
  });

  it("押し切ったあとに足すと、そこから再開する", () => {
    const g = new GuidedPractice([[60]]);
    expect(g.press(60)).toEqual({ kind: "done" });
    g.append([[62]]);
    expect(g.done).toBe(false);
    expect(g.current).toEqual([62]);
  });

  it("空の手を足しても増えない", () => {
    const g = new GuidedPractice([[60]]);
    g.append([[]]);
    expect(g.remainingSteps).toBe(1);
  });
});
