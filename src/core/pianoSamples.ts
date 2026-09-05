import { MIDI_MIN, MIDI_MAX } from "./notes.ts";

// Salamander の短3度ごとの録音。88鍵を最大±1半音の移調でカバーする。
// MP3 は同じサイトから配信し、演奏中に外部音源サービスへ接続しない。
export const PIANO_SAMPLES = Array.from({ length: 30 }, (_, i) => {
  const midi = MIDI_MIN + i * 3;
  const pitch = ["C", "Ds", "Fs", "A"][(midi % 12) / 3]!;
  return { midi, file: `${pitch}${Math.floor(midi / 12) - 1}.mp3` };
});

export function pianoSampleFor(midi: number): { midi: number; file: string } {
  const index = Math.round((Math.max(MIDI_MIN, Math.min(MIDI_MAX, midi)) - MIDI_MIN) / 3);
  return PIANO_SAMPLES[index]!;
}

/** 全音域をまとめて切り替える。一部だけ別音色になる状態は作らない。 */
export async function loadPianoSamples(ctx: BaseAudioContext): Promise<Map<number, AudioBuffer>> {
  const controller = new AbortController();
  const buffers = new Map<number, AudioBuffer>();
  let next = 0;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("ピアノ音源の読み込みがタイムアウトしました"));
    }, 12000);
  });
  const worker = async () => {
    while (next < PIANO_SAMPLES.length && !controller.signal.aborted) {
      const sample = PIANO_SAMPLES[next++]!;
      const response = await fetch(`./audio/piano/${sample.file}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`ピアノ音源を読み込めません: ${sample.file}`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      if (!controller.signal.aborted) buffers.set(sample.midi, buffer);
    }
  };
  try {
    // 同時デコードを絞り、タブレットで一度に処理が集中するのを避ける。
    await Promise.race([Promise.all(Array.from({ length: 4 }, worker)), timeout]);
    return buffers;
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
