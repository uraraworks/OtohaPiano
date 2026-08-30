// 打鍵記録の再生。音を鳴らし、鍵盤を光らせる。
//
// 時計を自前で持たないのが要点。動画に紐づく記録は「今の動画時刻」を
// 外から渡してもらうだけにしてある。こうするとシーク・A-B リピート・
// 速度変更への追従が、追従のためのコードなしで成立する。
// 動画なしの記録のときだけ、内部の時計を回す。

import { eventsInWindow, eventsAt, type Take } from "./takes.ts";

export interface TakePlaybackOptions {
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
  onGuide: (midi: number, on: boolean) => void;
  /** 表示更新(ドレミの現在位置など)。 */
  onTime?: (time: number) => void;
  onEnd?: () => void;
}

/** 時刻がこれ以上飛んだらシークとみなし、鳴っている音を作り直す。 */
const SEEK_THRESHOLD_SEC = 0.5;

export class TakePlayback {
  private opts: TakePlaybackOptions;
  private take: Take | null = null;
  private lastTime = 0;
  private sounding = true;
  private lighting = true;
  /** 消灯・消音の予約。停止時にまとめて取り消す。 */
  private pending = new Set<number>();
  private activeMidi = new Set<number>();
  private rate = 1;
  private ownClock: number | null = null;
  private clockStart = 0;

  constructor(opts: TakePlaybackOptions) {
    this.opts = opts;
  }

  get playing(): boolean {
    return this.take !== null;
  }

  get current(): Take | null {
    return this.take;
  }

  setSounding(on: boolean): void {
    this.sounding = on;
    if (!on) this.silenceAll();
  }

  setLighting(on: boolean): void {
    this.lighting = on;
    if (!on) this.unlightAll();
  }

  /** 動画に紐づく記録を、動画の時刻に合わせて再生する。 */
  startWithVideo(take: Take, currentTime: number, rate: number): void {
    this.stop();
    this.take = take;
    this.rate = rate;
    this.lastTime = currentTime;
  }

  /** 動画なしの記録を、自前の時計で再生する。 */
  startStandalone(take: Take, rate: number): void {
    this.stop();
    this.take = take;
    this.rate = rate;
    // 記録の原点は最初の打鍵の時刻。頭の空白を待たされないようにする。
    const first = take.events[0]?.at ?? 0;
    this.lastTime = first - 0.001;
    this.clockStart = performance.now();
    const tick = (): void => {
      if (!this.take) return;
      const elapsed = ((performance.now() - this.clockStart) / 1000) * this.rate;
      const t = first + elapsed;
      this.advance(t);
      this.opts.onTime?.(t);
      if (t > take.duration + first + 0.5) {
        this.stop();
        this.opts.onEnd?.();
        return;
      }
      this.ownClock = requestAnimationFrame(tick);
    };
    this.ownClock = requestAnimationFrame(tick);
  }

  setRate(rate: number): void {
    this.rate = rate;
  }

  /**
   * 動画の再生位置が進んだことを知らせる。動画に紐づく再生中だけ意味を持つ。
   * 呼び出し側は毎 tick 呼ぶだけでよい。
   */
  onVideoTime(time: number): void {
    if (!this.take || this.ownClock !== null) return;
    this.advance(time);
  }

  private advance(time: number): void {
    const take = this.take;
    if (!take) return;

    const jumped = time < this.lastTime || time - this.lastTime > SEEK_THRESHOLD_SEC;
    if (jumped) {
      // シーク。鳴りっぱなしを消してから、その時刻に鳴っているはずの音を作り直す。
      this.silenceAll();
      this.unlightAll();
      this.lastTime = time;
      for (const e of eventsAt(take.events, time)) {
        const remain = e.at + e.dur - time;
        this.fire(e.midi, remain);
      }
      return;
    }

    for (const e of eventsInWindow(take.events, this.lastTime, time)) {
      this.fire(e.midi, e.dur);
    }
    this.lastTime = time;
  }

  /** @param durInTakeTime 記録上の長さ(秒)。実時間へは速度で割って直す。 */
  private fire(midi: number, durInTakeTime: number): void {
    if (this.sounding) this.opts.onNoteOn(midi);
    if (this.lighting) this.opts.onGuide(midi, true);
    this.activeMidi.add(midi);
    const ms = Math.max(30, (durInTakeTime / Math.max(0.05, this.rate)) * 1000);
    const timer = window.setTimeout(() => {
      this.pending.delete(timer);
      this.activeMidi.delete(midi);
      this.opts.onNoteOff(midi);
      this.opts.onGuide(midi, false);
    }, ms);
    this.pending.add(timer);
  }

  private silenceAll(): void {
    for (const t of this.pending) window.clearTimeout(t);
    this.pending.clear();
    for (const midi of this.activeMidi) {
      this.opts.onNoteOff(midi);
      this.opts.onGuide(midi, false);
    }
    this.activeMidi.clear();
  }

  private unlightAll(): void {
    for (const midi of this.activeMidi) this.opts.onGuide(midi, false);
  }

  stop(): void {
    if (this.ownClock !== null) cancelAnimationFrame(this.ownClock);
    this.ownClock = null;
    this.silenceAll();
    this.take = null;
  }
}
