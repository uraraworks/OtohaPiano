// メトロノーム。
//
// setInterval で鳴らすと、他の処理が詰まった瞬間に拍がよれる。
// Web Audio は「未来の時刻を指定して鳴らす」ことができるので、
// 少し先までのクリックを先読みして予約する(先読みスケジューリング)。
// 予約の見直し自体は setInterval で回してよい(ずれるのは予約のタイミングだけで、
// 鳴る時刻はオーディオクロックで正確)。

import type { Synth } from "./synth.ts";

/** 何秒先まで予約しておくか。25ms 間隔で見直すので余裕をもって 0.2 秒。 */
const LOOKAHEAD_SEC = 0.2;
const TICK_MS = 25;

export class Metronome {
  private synth: Synth;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private beat = 0;
  private bpm = 100;
  private beatsPerBar = 4;

  /** 拍が鳴るたびに呼ばれる(画面のランプ用)。 */
  onBeat: ((beat: number, beatsPerBar: number) => void) | null = null;

  constructor(synth: Synth) {
    this.synth = synth;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  getBpm(): number {
    return this.bpm;
  }

  setBpm(bpm: number): void {
    // 極端な値は音にならないので実用域に丸める。
    this.bpm = Math.max(30, Math.min(240, Math.round(bpm)));
  }

  getBeatsPerBar(): number {
    return this.beatsPerBar;
  }

  setBeatsPerBar(n: number): void {
    this.beatsPerBar = Math.max(1, Math.min(8, Math.round(n)));
  }

  start(): void {
    if (this.timer !== null) return;
    this.beat = 0;
    // 今すぐではなく少し先から始める。予約が間に合わず 1 拍目を落とすのを防ぐ。
    this.nextNoteTime = this.synth.now() + 0.08;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  toggle(): boolean {
    if (this.running) this.stop();
    else this.start();
    return this.running;
  }

  private schedule(): void {
    const now = this.synth.now();
    while (this.nextNoteTime < now + LOOKAHEAD_SEC) {
      const isAccent = this.beat % this.beatsPerBar === 0;
      this.synth.click(isAccent, this.nextNoteTime);
      const beatForUi = this.beat % this.beatsPerBar;
      const delayMs = Math.max(0, (this.nextNoteTime - now) * 1000);
      // 画面のランプは音と同時に光らせたいので、鳴る時刻に合わせて遅らせる。
      window.setTimeout(() => this.onBeat?.(beatForUi, this.beatsPerBar), delayMs);
      this.nextNoteTime += 60 / this.bpm;
      this.beat++;
    }
  }
}

/**
 * タップテンポ。叩いた時刻の列から BPM を求める。
 * 直近の間隔だけを使い、大きく外れた間隔(叩き直し)はそこで区切る。
 * 純粋関数なのでテストで固められる。
 *
 * @param taps 叩いた時刻(ミリ秒)の昇順。
 * @returns BPM。判定に足りなければ null。
 */
export function bpmFromTaps(taps: number[]): number | null {
  if (taps.length < 2) return null;
  const intervals: number[] = [];
  for (let i = taps.length - 1; i > 0; i--) {
    const gap = taps[i]! - taps[i - 1]!;
    // 2 秒以上空いたら「叩き直し」とみなし、それより前は使わない。
    if (gap > 2000 || gap <= 0) break;
    intervals.unshift(gap);
    if (intervals.length >= 7) break; // 直近 8 タップぶんで十分
  }
  if (intervals.length === 0) return null;
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60000 / avg);
  if (bpm < 30 || bpm > 240) return null;
  return bpm;
}
