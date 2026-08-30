import { describe, it, expect } from "vitest";
import { TakeRecorder, eventsInWindow, eventsAt, type NoteEvent } from "../src/core/takes.ts";

describe("TakeRecorder", () => {
  it("押して離した打鍵を長さ付きで記録する", () => {
    const r = new TakeRecorder();
    r.start(10);
    r.noteOn(60, 10.5);
    r.noteOff(60, 11.0);
    const result = r.finish(12);
    expect(result).not.toBeNull();
    expect(result!.events).toEqual([{ midi: 60, at: 10.5, dur: 0.5 }]);
    // 長さは記録の原点(10)からの差
    expect(result!.duration).toBeCloseTo(1.0, 6);
  });

  it("和音は同じ時刻の複数打鍵として残る", () => {
    const r = new TakeRecorder();
    r.start(0);
    r.noteOn(60, 1);
    r.noteOn(64, 1);
    r.noteOn(67, 1);
    r.noteOff(60, 2);
    r.noteOff(64, 2);
    r.noteOff(67, 2);
    expect(r.finish(2)!.events).toHaveLength(3);
  });

  it("押しっぱなしのまま録音を止めても閉じられる", () => {
    const r = new TakeRecorder();
    r.start(0);
    r.noteOn(60, 1);
    const result = r.finish(3);
    expect(result!.events[0]!.dur).toBeCloseTo(2, 6);
  });

  it("同じ鍵の押し直しは前の音を閉じてから始める", () => {
    const r = new TakeRecorder();
    r.start(0);
    r.noteOn(60, 1);
    r.noteOn(60, 1.5); // 離鍵を挟まずに再度押す
    const events = r.finish(2)!.events;
    expect(events).toHaveLength(2);
    expect(events[0]!.dur).toBeCloseTo(0.5, 6);
  });

  it("シークで時刻が巻き戻っても負の長さを作らない", () => {
    const r = new TakeRecorder();
    r.start(0);
    r.noteOn(60, 5);
    r.noteOff(60, 2); // 巻き戻った
    expect(r.finish(2)!.events[0]!.dur).toBeGreaterThan(0);
  });

  it("何も押さなければ null", () => {
    const r = new TakeRecorder();
    r.start(0);
    expect(r.finish(5)).toBeNull();
  });

  it("結果は必ず時刻の昇順", () => {
    const r = new TakeRecorder();
    r.start(0);
    r.noteOn(72, 3);
    r.noteOff(72, 3.2);
    r.noteOn(60, 1);
    r.noteOff(60, 1.2);
    const ats = r.finish(4)!.events.map((e) => e.at);
    expect(ats).toEqual([...ats].sort((a, b) => a - b));
  });
});

const EVENTS: NoteEvent[] = [
  { midi: 60, at: 1.0, dur: 0.5 },
  { midi: 62, at: 2.0, dur: 0.5 },
  { midi: 64, at: 3.0, dur: 2.0 },
];

describe("eventsInWindow", () => {
  it("(from, to] の範囲で始まる打鍵だけを返す", () => {
    expect(eventsInWindow(EVENTS, 0.9, 1.0).map((e) => e.midi)).toEqual([60]);
    // 下端は開区間。同じ打鍵を二度鳴らさないための境界。
    expect(eventsInWindow(EVENTS, 1.0, 1.5)).toEqual([]);
    expect(eventsInWindow(EVENTS, 0, 3)).toHaveLength(3);
  });

  it("進んでいない・巻き戻った窓では何も返さない", () => {
    expect(eventsInWindow(EVENTS, 2, 2)).toEqual([]);
    expect(eventsInWindow(EVENTS, 3, 1)).toEqual([]);
  });
});

describe("eventsAt", () => {
  it("その時刻に鳴っている打鍵(シーク直後の復帰に使う)", () => {
    expect(eventsAt(EVENTS, 3.5).map((e) => e.midi)).toEqual([64]);
    expect(eventsAt(EVENTS, 5.0)).toEqual([]); // 3.0 + 2.0 の終端は含まない
    expect(eventsAt(EVENTS, 1.7)).toEqual([]); // 音の隙間
  });
});
