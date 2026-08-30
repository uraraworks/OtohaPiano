// お手本その 2「音声録音メモ」。
// 本物のピアノ・先生・友達の演奏など、アプリの外の音を端末内に残す。
//
// マイクが無い端末では録音ボタンごと出さない(押しても失敗するボタンを見せない)。
// 録音データはどこにも送らない。IndexedDB に置くだけ。

import { loadJson, saveJson, newId } from "./storage.ts";
import { putBlob, getBlob, deleteBlob } from "./blobStore.ts";

export interface MemoMeta {
  id: string;
  name: string;
  videoId: string | null;
  createdAt: number;
  /** 秒。録音終了時に計測した値。 */
  duration: number;
  mime: string;
}

const STORE_NAME = "memos";

export function loadMemos(): MemoMeta[] {
  const list = loadJson<MemoMeta[]>(STORE_NAME, []);
  return Array.isArray(list) ? list.filter((m): m is MemoMeta => typeof m?.id === "string") : [];
}

export function saveMemos(list: MemoMeta[]): boolean {
  return saveJson(STORE_NAME, list);
}

/**
 * マイクが使えるか。
 * getUserMedia の有無だけを見て、権限は聞かない(起動時に許可ダイアログを出さないため)。
 * 実際に使えるかは録音開始時に分かる。
 */
export function micAvailable(): boolean {
  return typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia !== undefined;
}

/** 端末が対応している中から録音形式を選ぶ(Safari は mp4、Chrome は webm)。 */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export class AudioMemoRecorder {
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  get recording(): boolean {
    return this.recorder !== null && this.recorder.state === "recording";
  }

  /** @throws 権限を断られた / マイクが無い場合。呼び出し側で利用者に伝える。 */
  async start(): Promise<void> {
    if (this.recording) return;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
    this.startedAt = performance.now();
  }

  /** @returns 保存した Blob と長さ。何も録れていなければ null。 */
  async stop(): Promise<{ blob: Blob; duration: number; mime: string } | null> {
    const rec = this.recorder;
    if (!rec || rec.state === "inactive") return null;
    const done = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    rec.stop();
    await done;
    // マイクの使用中表示を消すため、必ずトラックを止める。
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    if (this.chunks.length === 0) return null;
    const mime = rec.mimeType !== "" ? rec.mimeType : "audio/webm";
    const blob = new Blob(this.chunks, { type: mime });
    this.chunks = [];
    return { blob, duration: (performance.now() - this.startedAt) / 1000, mime };
  }

  /** 画面から離れるときなど、保存せずに捨てる。 */
  cancel(): void {
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}

export async function storeMemo(meta: MemoMeta, blob: Blob): Promise<void> {
  await putBlob(meta.id, blob);
}

export async function memoUrl(id: string): Promise<string | null> {
  const blob = await getBlob(id);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function removeMemo(list: MemoMeta[], id: string): Promise<MemoMeta[]> {
  await deleteBlob(id).catch(() => undefined);
  return list.filter((m) => m.id !== id);
}

export function newMemoId(): string {
  return newId();
}
