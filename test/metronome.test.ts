import { describe, it, expect } from "vitest";
import { bpmFromTaps } from "../src/core/metronome.ts";

describe("bpmFromTaps", () => {
  it("等間隔のタップから BPM を求める", () => {
    // 500ms 間隔 = 120 BPM
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
  });

  it("1 回だけでは判定しない", () => {
    expect(bpmFromTaps([0])).toBeNull();
    expect(bpmFromTaps([])).toBeNull();
  });

  it("2 秒以上あいたら叩き直しとみなし、それより前は使わない", () => {
    // 前半は遅いテンポ、5 秒あけて 500ms 間隔で叩き直した
    expect(bpmFromTaps([0, 1500, 6500, 7000, 7500])).toBe(120);
  });

  it("実用域を外れる速さは採用しない", () => {
    expect(bpmFromTaps([0, 100])).toBeNull(); // 600 BPM
  });

  it("2 秒を超える間隔は「間があいた」扱いで、遅すぎる BPM にはならない", () => {
    // 30 BPM 未満は間隔が 2 秒超になり、そこで区切られるので結果は null。
    // つまり下限は「叩き直しの判定」と同じ境界に落ちる。
    expect(bpmFromTaps([0, 2500])).toBeNull();
    expect(bpmFromTaps([0, 1900])).toBe(32); // 境界の内側は採用する
  });

  it("多少ばらついても平均で拾う", () => {
    const bpm = bpmFromTaps([0, 510, 990, 1500]);
    expect(bpm).toBeGreaterThanOrEqual(118);
    expect(bpm).toBeLessThanOrEqual(122);
  });
});
