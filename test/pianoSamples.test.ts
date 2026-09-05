import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadPianoSamples, pianoSampleFor, PIANO_SAMPLES } from "../src/core/pianoSamples.ts";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("ピアノ音源", () => {
  it("88鍵を最大1半音の移調でカバーし、対応ファイルが同梱されている", () => {
    for (let midi = 21; midi <= 108; midi++) {
      const sample = pianoSampleFor(midi);
      expect(Math.abs(sample.midi - midi)).toBeLessThanOrEqual(1);
      expect(existsSync(new URL(`../public/audio/piano/${sample.file}`, import.meta.url))).toBe(true);
    }
    expect(pianoSampleFor(21).file).toBe("A0.mp3");
    expect(pianoSampleFor(60).file).toBe("C4.mp3");
    expect(pianoSampleFor(108).file).toBe("C8.mp3");
  });

  it("配布元と照合した音源を改変せず、合計2.1MB以内で同梱する", () => {
    const manifest = JSON.parse(readFileSync(new URL("../public/audio/piano/manifest.json", import.meta.url), "utf8"));
    expect(manifest.files.map((f: { file: string }) => f.file).sort()).toEqual(PIANO_SAMPLES.map(s => s.file).sort());
    let total = 0;
    for (const file of manifest.files) {
      const data = readFileSync(new URL(`../public/audio/piano/${file.file}`, import.meta.url));
      expect(createHash("sha256").update(data).digest("hex")).toBe(file.sha256);
      total += data.length;
    }
    expect(total).toBeLessThan(2_100_000);
  });

  it("全音域をデコードし、同じサイトの相対URLから取得する", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
    vi.stubGlobal("fetch", fetchMock);
    const buffer = {} as AudioBuffer;
    const ctx = { decodeAudioData: vi.fn(async () => buffer) } as unknown as BaseAudioContext;
    const loaded = await loadPianoSamples(ctx);
    expect(loaded.size).toBe(30);
    expect(loaded.get(60)).toBe(buffer);
    expect(fetchMock.mock.calls).toHaveLength(30);
    expect(vi.mocked(fetch).mock.calls.every(([url]) => String(url).startsWith("./audio/piano/"))).toBe(true);
  });

  it("一部の404でも不完全な音源を返さず、残りの取得を中断する", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
      signals.push(options.signal);
      return { ok: false };
    }));
    await expect(loadPianoSamples({} as BaseAudioContext)).rejects.toThrow("読み込めません");
    expect(signals.every(s => s.aborted)).toBe(true);
  });

  it("デコードが完了しなくても12秒でタイムアウトする", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })));
    const ctx = { decodeAudioData: () => new Promise(() => {}) } as unknown as BaseAudioContext;
    const pending = expect(loadPianoSamples(ctx)).rejects.toThrow("タイムアウト");
    await vi.advanceTimersByTimeAsync(12000);
    await pending;
  });
});
