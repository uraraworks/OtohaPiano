// 端末内保存。サーバーを持たない前提なので、保存先はこの 2 つだけ。
//   localStorage … 小さい JSON(ライブラリ・打鍵記録)。同期的に読めて起動が速い。
//   IndexedDB    … 音声録音メモの Blob。localStorage には入らない大きさ。
//
// キーには版番号を含める。将来データの形を変えたとき、
// 古い形を読んで壊れるより、キーごと切り替えて作り直す方が安全。

const NS = "otoha.v1";

function key(name: string): string {
  return `${NS}.${name}`;
}

/** 壊れた JSON・容量超過で落ちないよう、読み書きは必ずここを通す。 */
export function loadJson<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJson(name: string, value: unknown): boolean {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
    return true;
  } catch {
    // 容量超過。呼び出し側が利用者に伝えられるよう false を返す。
    return false;
  }
}

/** 衝突しない ID。時刻順に並ぶので、そのまま「追加順」になる。 */
export function newId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${rand}`;
}
