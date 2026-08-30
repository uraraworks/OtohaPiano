// 音源。Web Audio だけで音を合成する。
//
// なぜサンプル音源(サウンドフォント)を使わないか:
//   企画の柱が「完全静的・サーバー不要・権利問題なし」。サウンドフォントは
//   数 MB の外部ファイル + ライセンス確認が要る。プロトタイプの目的は
//   「押したら鳴る」の手触りを確かめることなので、まず合成音で通す。
//   差し替えるときはこのファイルの play/stop を保ったまま中身だけ替えればよい。

import { midiToFreq } from "./notes.ts";

/** 倍音の並びと包絡線で楽器の音色を作る。 */
export interface Instrument {
  id: string;
  label: string;
  /** ボタンに出す絵文字。文字が読めなくても選べるように。 */
  emoji: string;
  /** 各倍音の [倍率, 音量, 波形]。倍率 1 が基音。 */
  partials: Array<[number, number, OscillatorType]>;
  /** 立ち上がり(秒)。小さいほど硬い音。 */
  attack: number;
  /** 鍵を押している間に減っていく速さ(秒)。0 なら減衰しない(オルガン系)。 */
  decay: number;
  /** 減衰後に残る音量の割合。 */
  sustain: number;
  /** 離鍵後に消えるまで(秒)。 */
  release: number;
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: "piano",
    label: "ピアノ",
    emoji: "🎹",
    // 基音 + 弱い倍音。押したまま徐々に減衰するのがピアノらしさ。
    partials: [[1, 1.0, "triangle"], [2, 0.32, "sine"], [3, 0.14, "sine"], [4, 0.06, "sine"]],
    attack: 0.004,
    decay: 2.4,
    sustain: 0.0,
    release: 0.32,
  },
  {
    id: "organ",
    label: "エレクトーン",
    emoji: "🎛️",
    // 押している間ずっと同じ音量で鳴り続ける(減衰しない)のがオルガン系。
    partials: [[1, 0.9, "sine"], [2, 0.5, "sine"], [3, 0.28, "sine"], [4, 0.2, "sine"], [8, 0.1, "sine"]],
    attack: 0.02,
    decay: 0.1,
    sustain: 0.85,
    release: 0.12,
  },
  {
    id: "musicbox",
    label: "オルゴール",
    // ト音記号ではオルゴールに見えないので、金属の弁をはじく音に寄せて鈴にする。
    emoji: "🔔",
    partials: [[1, 0.8, "sine"], [4, 0.35, "sine"], [7.2, 0.18, "sine"], [11, 0.07, "sine"]],
    attack: 0.002,
    decay: 1.1,
    sustain: 0.0,
    release: 0.5,
  },
  {
    id: "strings",
    label: "ストリングス",
    emoji: "🎻",
    partials: [[1, 0.7, "sawtooth"], [2, 0.18, "sine"], [3, 0.08, "sine"]],
    attack: 0.14,
    decay: 0.3,
    sustain: 0.7,
    release: 0.45,
  },
];

interface Voice {
  osc: OscillatorNode[];
  gain: GainNode;
  /** 離鍵処理を二重に走らせないための印。 */
  releasing: boolean;
}

export class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /**
   * 鳴っている音。同じ鍵を連打したとき前の音を確実に止めるため MIDI 番号で引く。
   * 1 鍵 1 発音(モノ)にすると、押し直しの音が濁らない。
   */
  private voices = new Map<number, Voice>();
  private instrument: Instrument = INSTRUMENTS[0]!;
  private volume = 0.7;

  /**
   * 音声を解禁する。ブラウザの自動再生制限があるため、
   * 必ずユーザーのタップ(「はじめる」ボタン)の中から呼ぶ。
   */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  /** 打鍵記録の時刻の基準に使う。unlock 前は 0。 */
  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setInstrument(id: string): void {
    const found = INSTRUMENTS.find((i) => i.id === id);
    if (found) this.instrument = found;
  }

  getInstrument(): Instrument {
    return this.instrument;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
  }

  getVolume(): number {
    return this.volume;
  }

  /** 鍵を押す。velocity は 0〜1。 */
  noteOn(midi: number, velocity = 1): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    this.noteOff(midi, true);

    const inst = this.instrument;
    const t0 = ctx.currentTime;
    const gain = ctx.createGain();
    // 高い音ほど耳につくので、上に行くほど少し絞る(そうしないと最高音だけ刺さる)。
    const tilt = Math.pow(0.5, Math.max(0, midi - 60) / 36);
    const peak = 0.28 * velocity * tilt;

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + inst.attack);
    if (inst.decay > 0) {
      const sustainLevel = Math.max(0.0001, peak * inst.sustain);
      // 指数カーブの方が自然に減衰して聞こえる。0 は渡せないので下限を置く。
      gain.gain.setTargetAtTime(sustainLevel, t0 + inst.attack, inst.decay / 3);
    }
    gain.connect(master);

    const osc: OscillatorNode[] = [];
    for (const [ratio, level, type] of inst.partials) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = midiToFreq(midi) * ratio;
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g);
      g.connect(gain);
      o.start(t0);
      osc.push(o);
    }
    this.voices.set(midi, { osc, gain, releasing: false });
  }

  /**
   * 鍵を離す。
   * @param immediate 同じ鍵の押し直しで前の音を潰すときだけ true(余韻を残さない)。
   */
  noteOff(midi: number, immediate = false): void {
    const ctx = this.ctx;
    const v = this.voices.get(midi);
    if (!ctx || !v || v.releasing) return;
    v.releasing = true;
    this.voices.delete(midi);

    const t0 = ctx.currentTime;
    const rel = immediate ? 0.01 : this.instrument.release;
    v.gain.gain.cancelScheduledValues(t0);
    v.gain.gain.setValueAtTime(Math.max(v.gain.gain.value, 0.0001), t0);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + rel);
    for (const o of v.osc) o.stop(t0 + rel + 0.02);
    // ramp が終わってから切り離す。早すぎるとプツッと切れる。
    setTimeout(() => v.gain.disconnect(), (rel + 0.1) * 1000);
  }

  /** 全部止める(画面の切り替えや録音再生の停止で使う)。 */
  allNotesOff(): void {
    for (const midi of [...this.voices.keys()]) this.noteOff(midi);
  }

  /** メトロノームのクリック音。鍵盤とは別系統の短い音。 */
  click(accent: boolean, atTime?: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = atTime ?? ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = accent ? 1600 : 1050;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(accent ? 0.22 : 0.13, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + 0.08);
  }
}
