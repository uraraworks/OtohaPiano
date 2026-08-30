// お手本その 1「打鍵記録(光る鍵盤)」。
//
// 音声解析を諦めた代わりの中核機能。上手な人がこのアプリの鍵盤で弾き、
// 「どの鍵を・いつ・どれだけ」だけを MIDI と同じ考え方で残す。数 KB で済む。
//
// 動画を再生しながら録ると、時刻の基準が動画の再生位置になる。
// これが効いて、シーク・A-B リピート・速度変更に何もせず追従する
// (再生側は毎 tick「今の動画時刻」を渡すだけでよい)。

import { loadJson, saveJson, newId } from "./storage.ts";

export interface NoteEvent {
  midi: number;
  /** 開始時刻(秒)。動画に紐づく記録なら動画の再生位置、そうでなければ録音開始からの経過。 */
  at: number;
  /** 長さ(秒)。 */
  dur: number;
}

export interface Take {
  id: string;
  name: string;
  /** 紐づく動画。null なら動画なしで単体録音したもの。 */
  videoId: string | null;
  instrument: string;
  createdAt: number;
  /** at の昇順。再生時に毎回並べ替えないで済むよう、保存時点で整える。 */
  events: NoteEvent[];
  /** 記録の長さ(秒)。単体録音の進捗表示に使う。 */
  duration: number;
}

const STORE_NAME = "takes";

export function loadTakes(): Take[] {
  const list = loadJson<Take[]>(STORE_NAME, []);
  if (!Array.isArray(list)) return [];
  return list.filter((t): t is Take => typeof t?.id === "string" && Array.isArray(t.events));
}

export function saveTakes(list: Take[]): boolean {
  return saveJson(STORE_NAME, list);
}

export function takesForVideo(list: Take[], videoId: string | null): Take[] {
  return list.filter((t) => t.videoId === videoId);
}

/**
 * 打鍵を組み立てる。
 * 押しっぱなしのまま録音を止めることが普通にあるので、
 * finish() で開きっぱなしの音を閉じる責任をここが持つ。
 */
export class TakeRecorder {
  private open = new Map<number, NoteEvent>();
  private events: NoteEvent[] = [];
  private startedAt = 0;
  private lastAt = 0;

  /** @param startTime 記録の原点(動画時刻 or 0)。 */
  start(startTime: number): void {
    this.open.clear();
    this.events = [];
    this.startedAt = startTime;
    this.lastAt = startTime;
  }

  /** @param time 押した瞬間の時刻(start と同じ尺度)。 */
  noteOn(midi: number, time: number): void {
    // 同じ鍵が開いたままなら、そこで一度閉じる(押し直し)。
    this.noteOff(midi, time);
    const ev: NoteEvent = { midi, at: time, dur: 0 };
    this.open.set(midi, ev);
    this.events.push(ev);
    this.lastAt = Math.max(this.lastAt, time);
  }

  noteOff(midi: number, time: number): void {
    const ev = this.open.get(midi);
    if (!ev) return;
    // 動画をシークしながら弾くと時刻が巻き戻ることがある。負の長さは作らない。
    ev.dur = Math.max(0.03, time - ev.at);
    this.open.delete(midi);
    this.lastAt = Math.max(this.lastAt, time);
  }

  /** 今のところ何個入っているか(録音中の表示用)。 */
  get count(): number {
    return this.events.length;
  }

  /**
   * 記録を確定する。開いたままの音は endTime で閉じる。
   * @returns at 昇順に整列した打鍵列と長さ。空なら null。
   */
  finish(endTime: number): { events: NoteEvent[]; duration: number } | null {
    for (const midi of [...this.open.keys()]) this.noteOff(midi, endTime);
    if (this.events.length === 0) return null;
    const events = [...this.events].sort((a, b) => a.at - b.at);
    const last = events.reduce((mx, e) => Math.max(mx, e.at + e.dur), 0);
    return { events, duration: Math.max(0, last - this.startedAt) };
  }
}

/**
 * 時刻 (from, to] の範囲で始まる打鍵を返す。
 * 再生側は毎 tick これを呼ぶだけでよく、シークで時刻が飛んでも
 * 「範囲外＝何も鳴らさない」で自然に処理できる。
 * events は at 昇順である前提。
 */
export function eventsInWindow(events: NoteEvent[], from: number, to: number): NoteEvent[] {
  if (to <= from) return [];
  const out: NoteEvent[] = [];
  for (const e of events) {
    if (e.at > to) break; // 昇順なのでここから先は全部範囲外
    if (e.at > from) out.push(e);
  }
  return out;
}

/**
 * ある時刻に鳴っているはずの打鍵。
 * シーク直後に「光る鍵盤」を正しい状態へ復帰させるのに使う。
 */
export function eventsAt(events: NoteEvent[], time: number): NoteEvent[] {
  return events.filter((e) => e.at <= time && time < e.at + e.dur);
}

export function makeTake(
  name: string,
  videoId: string | null,
  instrument: string,
  events: NoteEvent[],
  duration: number,
): Take {
  return { id: newId(), name, videoId, instrument, createdAt: Date.now(), events, duration };
}
