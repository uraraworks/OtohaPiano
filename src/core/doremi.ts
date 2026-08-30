// 流れるドレミ表示。
//
// 打鍵記録から音名の列を作る。記録は「どの鍵を押したか」そのものなので、
// 音を推定する必要がなく、音階は 100% 正しい(解析を諦めた代わりに得た確実性)。
// カラオケ字幕と同じで、再生位置に合わせて今の音を光らせる。

import { noteNameJa, noteNameEn } from "./notes.ts";
import type { NoteEvent } from "./takes.ts";

export interface DoremiItem {
  /** 表示する文字。和音は「ドミソ」のようにまとめる。 */
  text: string;
  /** 英語音名(印刷用の補助表示)。 */
  en: string;
  at: number;
  dur: number;
}

/**
 * ほぼ同時に押された打鍵は 1 つの和音としてまとめる。
 * 人の演奏は完全に同時にならないので、この幅の中に入ったものを「同時」とみなす。
 */
const CHORD_WINDOW_SEC = 0.06;

/** @param events at 昇順の打鍵列。 */
export function buildDoremi(events: NoteEvent[]): DoremiItem[] {
  const items: DoremiItem[] = [];
  let group: NoteEvent[] = [];

  const flush = (): void => {
    if (group.length === 0) return;
    // 和音は低い音から書く(楽譜の並びに合わせる)。
    const sorted = [...group].sort((a, b) => a.midi - b.midi);
    const at = Math.min(...sorted.map((e) => e.at));
    const dur = Math.max(...sorted.map((e) => e.at + e.dur)) - at;
    items.push({
      text: sorted.map((e) => noteNameJa(e.midi)).join(""),
      en: sorted.map((e) => noteNameEn(e.midi)).join(" "),
      at,
      dur,
    });
    group = [];
  };

  for (const e of events) {
    const head = group[0];
    if (head !== undefined && e.at - head.at > CHORD_WINDOW_SEC) flush();
    group.push(e);
  }
  flush();
  return items;
}

/**
 * 今の時刻にあたる項目の位置。
 * 音が鳴っていない隙間では「直前に鳴った音」を指し続ける
 * (指標が消えると、どこを弾いているか見失うため)。
 * @returns index。まだ最初の音の前なら -1。
 */
export function activeIndex(items: DoremiItem[], time: number): number {
  let idx = -1;
  for (let i = 0; i < items.length; i++) {
    if (items[i]!.at <= time) idx = i;
    else break;
  }
  return idx;
}

/** 印刷用のプレーンテキスト。1 行 8 個で折り返す。 */
export function toPrintableText(items: DoremiItem[], perLine = 8): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += perLine) {
    lines.push(
      items
        .slice(i, i + perLine)
        .map((it) => it.text)
        .join("　"),
    );
  }
  return lines.join("\n");
}
