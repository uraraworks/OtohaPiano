import { describe, it, expect } from "vitest";
import { renderString, pianoStringOptions } from "../src/core/stringVoice.ts";

/** 決まった乱数。生成が毎回同じになるので、結果を検証できる。 */
function seededRng(seed = 1): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * 波形から基音の周期を求める（自己相関の最初の山）。
 * 音程が合っているかを確かめるために使う。
 */
function detectPeriod(wave: Float32Array, sampleRate: number, expected: number): number {
  const from = Math.max(2, Math.floor(expected * 0.5));
  const to = Math.min(Math.floor(expected * 2), Math.floor(wave.length / 2));
  // 立ち上がりを避け、安定した区間で測る。
  const start = Math.min(Math.floor(sampleRate * 0.05), Math.floor(wave.length / 4));
  const span = Math.min(4096, wave.length - start - to);
  let best = from;
  let bestScore = -Infinity;
  for (let lag = from; lag <= to; lag++) {
    let sum = 0;
    for (let i = 0; i < span; i++) sum += wave[start + i]! * wave[start + i + lag]!;
    if (sum > bestScore) {
      bestScore = sum;
      best = lag;
    }
  }
  return best;
}

describe("弦の波形", () => {
  const sampleRate = 48000;

  it("指定した長さぶん作る", () => {
    const wave = renderString({
      freq: 440, sampleRate, decaySeconds: 0.5, damping: 0.3,
      strings: 1, detuneCents: 0, brightness: 0.5, rng: seededRng(),
    });
    expect(wave).toHaveLength(24000);
  });

  it("音の高さが合っている（整数に丸めると高音でずれるので補間している）", () => {
    for (const freq of [220, 440, 880, 1760]) {
      const wave = renderString({
        freq, sampleRate, decaySeconds: 1, damping: 0.2,
        strings: 1, detuneCents: 0, brightness: 0.6, rng: seededRng(7),
      });
      const period = detectPeriod(wave, sampleRate, sampleRate / freq);
      const detected = sampleRate / period;
      // 自己相関の分解能ぶんの誤差は出るので、半音(約 6%)より十分内側であればよい。
      expect(Math.abs(detected - freq) / freq).toBeLessThan(0.03);
    }
  });

  it("時間が経つほど小さくなる", () => {
    const wave = renderString({
      freq: 261.6, sampleRate, decaySeconds: 2, damping: 0.3,
      strings: 3, detuneCents: 1.2, brightness: 0.5, rng: seededRng(3),
    });
    const rms = (from: number, to: number) => {
      let sum = 0;
      for (let i = from; i < to; i++) sum += wave[i]! * wave[i]!;
      return Math.sqrt(sum / (to - from));
    };
    const head = rms(0, 4800);
    const mid = rms(sampleRate, sampleRate + 4800);
    const tail = rms(wave.length - 4800, wave.length);
    expect(mid).toBeLessThan(head);
    expect(tail).toBeLessThan(mid);
  });

  it("音量は 1 に収まる（弦の本数や高さで音量が変わらない）", () => {
    for (const midi of [36, 48, 60, 72, 84]) {
      const wave = renderString(pianoStringOptions(midi, sampleRate, seededRng(midi)));
      let peak = 0;
      for (const v of wave) peak = Math.max(peak, Math.abs(v));
      expect(peak).toBeGreaterThan(0.5);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });

  it("同じ乱数からは同じ波形ができる（音の高さごとに使い回せる）", () => {
    const opts = () => ({
      freq: 440, sampleRate, decaySeconds: 0.3, damping: 0.3,
      strings: 2, detuneCents: 1.2, brightness: 0.5, rng: seededRng(11),
    });
    expect(Array.from(renderString(opts()).slice(0, 200))).toEqual(
      Array.from(renderString(opts()).slice(0, 200)),
    );
  });
});

describe("ピアノの設定", () => {
  it("低い音ほど長く伸びる", () => {
    const low = pianoStringOptions(36, 48000, seededRng());
    const high = pianoStringOptions(84, 48000, seededRng());
    expect(low.decaySeconds).toBeGreaterThan(high.decaySeconds);
  });

  it("中音以上は弦が 3 本（唸りが出る）", () => {
    expect(pianoStringOptions(36, 48000, seededRng()).strings).toBe(1);
    expect(pianoStringOptions(60, 48000, seededRng()).strings).toBe(3);
  });

  it("高い音ほど硬い", () => {
    const low = pianoStringOptions(36, 48000, seededRng());
    const high = pianoStringOptions(84, 48000, seededRng());
    expect(high.brightness).toBeGreaterThan(low.brightness);
  });
});
