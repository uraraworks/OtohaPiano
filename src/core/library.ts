// 練習する動画の一覧(ライブラリ)。
// 子供はサムネイルをタップするだけ。URL の登録は親が初回にやる想定。
// 検索機能は持たない(URL は YouTube アプリの共有から来る、が企画の決定)。

import { loadJson, saveJson } from "./storage.ts";
import { oembedUrl } from "./youtubeUrl.ts";

/** 「ここから練習」で覚えた再生位置。動画ごとに複数持てる。 */
export interface Mark {
  id: string;
  /** 秒。 */
  time: number;
  label: string;
}

export interface VideoEntry {
  /** YouTube の動画 ID。ライブラリ内で一意なのでこれを主キーにする。 */
  id: string;
  title: string;
  addedAt: number;
  marks: Mark[];
  /** 最後に使った A-B リピート区間。次に開いたとき続きから練習できる。 */
  loop: { start: number; end: number } | null;
}

const STORE_NAME = "library";

export function loadLibrary(): VideoEntry[] {
  const list = loadJson<VideoEntry[]>(STORE_NAME, []);
  if (!Array.isArray(list)) return [];
  // 保存データが古い / 壊れている場合に画面ごと落ちないよう、形を整えてから返す。
  return list
    .filter((e): e is VideoEntry => typeof e?.id === "string")
    .map((e) => ({
      id: e.id,
      title: typeof e.title === "string" && e.title !== "" ? e.title : e.id,
      addedAt: typeof e.addedAt === "number" ? e.addedAt : 0,
      marks: Array.isArray(e.marks) ? e.marks : [],
      loop: e.loop && typeof e.loop.start === "number" ? e.loop : null,
    }));
}

export function saveLibrary(list: VideoEntry[]): boolean {
  return saveJson(STORE_NAME, list);
}

/**
 * 動画を追加する。すでにある動画なら追加せず既存を返す。
 * @returns [更新後の一覧, 対象の項目, 新規追加だったか]
 */
export function addVideo(list: VideoEntry[], videoId: string, title: string): [VideoEntry[], VideoEntry, boolean] {
  const existing = list.find((e) => e.id === videoId);
  if (existing) return [list, existing, false];
  const entry: VideoEntry = { id: videoId, title, addedAt: Date.now(), marks: [], loop: null };
  // 新しいものを先頭に。子供は最近の曲を練習することが多い。
  return [[entry, ...list], entry, true];
}

export function removeVideo(list: VideoEntry[], videoId: string): VideoEntry[] {
  return list.filter((e) => e.id !== videoId);
}

export function updateVideo(list: VideoEntry[], videoId: string, patch: Partial<VideoEntry>): VideoEntry[] {
  return list.map((e) => (e.id === videoId ? { ...e, ...patch } : e));
}

/** マーカーは時刻順に並べる(押した順ではなく曲の順で並んでいてほしい)。 */
export function addMark(entry: VideoEntry, mark: Mark): VideoEntry {
  const marks = [...entry.marks, mark].sort((a, b) => a.time - b.time);
  return { ...entry, marks };
}

export function removeMark(entry: VideoEntry, markId: string): VideoEntry {
  return { ...entry, marks: entry.marks.filter((m) => m.id !== markId) };
}

/**
 * oEmbed でタイトルを取る。API キー不要。
 * 取れなかった場合(オフライン・限定公開など)は動画 ID をそのままタイトルにする。
 * ここで例外を投げると登録そのものが失敗してしまうので、必ず文字列を返す。
 */
export async function fetchTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(oembedUrl(videoId));
    if (!res.ok) return videoId;
    const data = (await res.json()) as { title?: unknown };
    return typeof data.title === "string" && data.title !== "" ? data.title : videoId;
  } catch {
    return videoId;
  }
}
