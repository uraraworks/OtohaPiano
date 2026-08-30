// 音源。Web Audio だけで音を合成する。
//
// なぜサンプル音源(サウンドフォント)を使わないか:
//   企画の柱が「完全静的・サーバー不要・権利問題なし」。サウンドフォントは
//   数 MB の外部ファイル + ライセンス確認が要る。プロトタイプの目的は
//   「押したら鳴る」の手触りを確かめることなので、まず合成音で通す。
//   差し替えるときはこのファイルの play/stop を保ったまま中身だけ替えればよい。

import { midiToFreq } from "./notes.ts";

/** 1 つの倍音。 */
export interface Partial {
  /** 基音に対する周波数の倍率。1 が基音。 */
  ratio: number;
  /** 音量。 */
  level: number;
  type: OscillatorType;
  /**
   * この倍音だけの減衰の速さ（楽器全体の decay に掛ける）。小さいほど速く消える。
   * ピアノらしさはここで決まる。実際の弦は高い倍音ほど速く減衰するので、
   * 全部の倍音を同じ速さで減衰させると、いつまでも硬い音が残って
   * オルガンのように聞こえる。
   */
  decayScale?: number;
}

/** 倍音の並びと包絡線で楽器の音色を作る。 */
export interface Instrument {
  id: string;
  label: string;
  /** ボタンに出す絵文字。文字が読めなくても選べるように。 */
  emoji: string;
  partials: Partial[];
  /** 立ち上がり(秒)。小さいほど硬い音。 */
  attack: number;
  /** 鍵を押している間に減っていく速さ(秒)。0 なら減衰しない(オルガン系)。 */
  decay: number;
  /** 減衰後に残る音量の割合。 */
  sustain: number;
  /** 離鍵後に消えるまで(秒)。 */
  release: number;
  /**
   * 弦の硬さによる倍音のずれ。ピアノの倍音は整数倍より少し高い所にある
   * (n 倍音が n 倍ちょうどだと、電子的な響きになる)。0 なら整数倍のまま。
   */
  inharmonicity?: number;
  /**
   * 高い音ほど速く減衰させるか。ピアノは低音が長く伸び、高音はすぐ消える。
   * 一律にすると、高い音がいつまでも鳴り続けて不自然になる。
   */
  decayTracksPitch?: boolean;
  /** 打鍵の瞬間に混ぜる音(ハンマーが弦を叩く音)。0〜1。 */
  hammer?: number;
}

/**
 * 倍音の並びを作る。
 * @param levels 基音から順に並べた音量。
 * @param decayFalloff 上の倍音がどれだけ速く消えるか。大きいほど速い。
 */
function harmonics(levels: number[], decayFalloff: number): Partial[] {
  return levels.map((level, i) => ({
    ratio: i + 1,
    level,
    type: "sine" as OscillatorType,
    decayScale: 1 / (1 + decayFalloff * i),
  }));
}

export const INSTRUMENTS: Instrument[] = [
  {
    id: "piano",
    label: "ピアノ",
    emoji: "🎹",
    // グランドピアノ。倍音は正弦波で積み、上へ行くほど弱く・速く消えるようにする。
    // 波形そのもの(三角波など)で作ると倍音の減衰を個別に制御できず、
    // 減衰しても音色が変わらない=電子オルガンのような響きになる。
    partials: harmonics([1.0, 0.52, 0.33, 0.21, 0.14, 0.09, 0.06, 0.04, 0.028, 0.018], 0.45),
    attack: 0.002,
    decay: 2.8,
    sustain: 0.0,
    release: 0.22,
    inharmonicity: 0.0006,
    decayTracksPitch: true,
    hammer: 0.5,
  },
  {
    id: "organ",
    label: "エレクトーン",
    emoji: "🎛️",
    // 押している間ずっと同じ音量で鳴り続ける(減衰しない)のがオルガン系。
    partials: [
      { ratio: 1, level: 0.9, type: "sine" },
      { ratio: 2, level: 0.5, type: "sine" },
      { ratio: 3, level: 0.28, type: "sine" },
      { ratio: 4, level: 0.2, type: "sine" },
      { ratio: 8, level: 0.1, type: "sine" },
    ],
    attack: 0.02,
    decay: 0.1,
    sustain: 0.85,
    release: 0.12,
  },
  {
    id: "musicbox",
    label: "オルゴール",
    emoji: "🔔",
    // 金属の弁をはじく音。倍音が整数倍から大きく外れているのが金属らしさで、
    // 上の倍音ほど速く消えると「チン」という当たりになる。
    partials: [
      { ratio: 1, level: 0.8, type: "sine", decayScale: 1 },
      { ratio: 3.9, level: 0.34, type: "sine", decayScale: 0.45 },
      { ratio: 8.2, level: 0.16, type: "sine", decayScale: 0.22 },
      { ratio: 13.5, level: 0.06, type: "sine", decayScale: 0.12 },
    ],
    attack: 0.002,
    decay: 1.3,
    sustain: 0.0,
    release: 0.5,
    decayTracksPitch: true,
    hammer: 0.35,
  },
  {
    id: "strings",
    label: "ストリングス",
    emoji: "🎻",
    partials: [
      { ratio: 1, level: 0.7, type: "sawtooth" },
      { ratio: 2, level: 0.18, type: "sine" },
      { ratio: 3, level: 0.08, type: "sine" },
    ],
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
  /** 打鍵音に使う雑音。1 つ作って使い回す。 */
  private noiseBuffer: AudioBuffer | null = null;

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

  /**
   * 弦の硬さによる倍音のずれ。n 倍音は n 倍より少し高い所に来る。
   * ちょうど整数倍だと、うなりが生まれず作り物めいた響きになる。
   */
  private partialFreq(baseFreq: number, ratio: number, inharmonicity: number): number {
    if (inharmonicity <= 0) return baseFreq * ratio;
    return baseFreq * ratio * Math.sqrt(1 + inharmonicity * ratio * ratio);
  }

  /** 打鍵の瞬間に混ぜる短い雑音(ハンマーが弦を叩く音)。 */
  private playHammer(amount: number, freq: number, t0: number, peak: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    if (!this.noiseBuffer) {
      // 使い回す。打鍵のたびに作ると、和音や連打で無駄が積み上がる。
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    // 音の高さに合わせて当たりの色も変える。低音は鈍く、高音は硬く。
    band.frequency.value = Math.min(6000, Math.max(600, freq * 4));
    band.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak * amount, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
    src.connect(band);
    band.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + 0.06);
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
    gain.gain.value = 1;
    // 高い音ほど耳につくので、上に行くほど少し絞る(そうしないと最高音だけ刺さる)。
    const tilt = Math.pow(0.5, Math.max(0, midi - 60) / 36);
    const peak = 0.28 * velocity * tilt;
    gain.connect(master);

    // ピアノは低音が長く伸び、高音はすぐ消える。一律にすると高音が鳴り残る。
    const pitchScale = inst.decayTracksPitch ? Math.pow(0.5, (midi - 48) / 30) : 1;
    const baseDecay = inst.decay * pitchScale;
    const baseFreq = midiToFreq(midi);

    // 倍音の合計で音量が決まってしまうと、倍音を増やした楽器だけ大きくなる。
    // 合計を一定に揃えて、楽器を切り替えても音量が変わらないようにする。
    const levelSum = inst.partials.reduce((a, p) => a + p.level, 0);
    const norm = levelSum > 0 ? 1.5 / levelSum : 1;

    const osc: OscillatorNode[] = [];
    for (const p of inst.partials) {
      const o = ctx.createOscillator();
      o.type = p.type;
      o.frequency.value = this.partialFreq(baseFreq, p.ratio, inst.inharmonicity ?? 0);
      // 倍音ごとに包絡線を持たせるのが要点。上の倍音を速く消すことで、
      // 鳴っている間に音色が丸くなっていく(これが弦らしさになる)。
      const g = ctx.createGain();
      const level = peak * p.level * norm;
      const dec = baseDecay * (p.decayScale ?? 1);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(level, t0 + inst.attack);
      if (dec > 0) {
        // 指数カーブの方が自然に減衰して聞こえる。0 は渡せないので下限を置く。
        g.gain.setTargetAtTime(Math.max(0.0001, level * inst.sustain), t0 + inst.attack, dec / 3);
      }
      o.connect(g);
      g.connect(gain);
      o.start(t0);
      osc.push(o);
    }

    if (inst.hammer) this.playHammer(inst.hammer, baseFreq, t0, peak);

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
