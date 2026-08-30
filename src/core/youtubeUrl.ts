// YouTube の URL / 共有文字列から動画 ID を取り出す。
//
// 企画書が「全形式対応のパーサー必須(v0 品質ポイント)」と名指ししている箇所。
// 親が YouTube アプリの「共有」から貼り付けるので、
// ?si= 付きの短縮 URL・前後の空白・共有テキスト混じりが普通に来る。
// 副作用も DOM 依存も無いのでテストで固められる。

/** 動画 ID は 11 文字の [A-Za-z0-9_-]。この形に合わないものは受け付けない。 */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** ID を含みうるホスト名(www. や m. の有無を吸収する)。 */
function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^(www|m|music)\./, "");
}

/**
 * @returns 動画 ID。取り出せなければ null。
 */
export function parseVideoId(input: string): string | null {
  const raw = input.trim();
  if (raw === "") return null;

  // ID をそのまま貼られた場合。
  if (VIDEO_ID_RE.test(raw)) return raw;

  // 共有テキスト("見てね https://youtu.be/xxx" 等)から URL 部分だけ拾う。
  const urlMatch = raw.match(/https?:\/\/[^\s<>"']+/i);
  const urlText = urlMatch ? urlMatch[0] : raw;

  let url: URL;
  try {
    // スキーム無し("youtu.be/xxx")でも通るように補う。
    url = new URL(/^https?:\/\//i.test(urlText) ? urlText : `https://${urlText}`);
  } catch {
    return null;
  }

  const host = normalizeHost(url.hostname);
  const segments = url.pathname.split("/").filter((s) => s !== "");

  // youtu.be/<id>
  if (host === "youtu.be") {
    return validate(segments[0]);
  }

  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get("v");
  if (v) return validate(v);

  // youtube.com/{embed,v,shorts,live}/<id>
  const first = segments[0];
  if (first === "embed" || first === "v" || first === "shorts" || first === "live") {
    return validate(segments[1]);
  }

  return null;
}

function validate(candidate: string | undefined): string | null {
  if (!candidate) return null;
  return VIDEO_ID_RE.test(candidate) ? candidate : null;
}

/**
 * URL に開始秒(&t=90s / #t=1m30s)が入っていれば拾う。
 * 「ここから練習」を共有 URL から引き継ぐために使う。
 * @returns 秒。無ければ null。
 */
export function parseStartSeconds(input: string): number | null {
  const urlMatch = input.match(/https?:\/\/[^\s<>"']+/i);
  const urlText = urlMatch ? urlMatch[0] : input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(urlText) ? urlText : `https://${urlText}`);
  } catch {
    return null;
  }
  const t = url.searchParams.get("t") ?? url.searchParams.get("start") ?? url.hash.replace(/^#t=/, "");
  if (!t) return null;
  return parseTimeToken(t);
}

/** "90" / "90s" / "1m30s" / "1h2m3s" を秒に直す。 */
export function parseTimeToken(token: string): number | null {
  const s = token.trim().toLowerCase();
  if (s === "") return null;
  if (/^\d+$/.test(s)) return Number(s);
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** サムネイル URL。API キー不要で取れる img.youtube.com を使う。 */
export function thumbnailUrl(videoId: string): string {
  // mqdefault は 320x180 で必ず存在する(maxres は無い動画がある)。
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

/** タイトル取得用の oEmbed URL。API キー不要。 */
export function oembedUrl(videoId: string): string {
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(
    `https://www.youtube.com/watch?v=${videoId}`,
  )}`;
}

/** 秒 → "1:23" / "1:02:03"。時間表示とマーカーのラベルで共用する。 */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, "0")}` : `${mm}:${String(s).padStart(2, "0")}`;
}
