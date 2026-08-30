// UI のアイコン。
//
// 絵文字をやめて自前の SVG にしてある。理由はいろは(Iroha Paint)と同じ:
// 絵文字は端末ごとに絵柄も色も変わるので、画面の見た目が揃わない。
// 「ずっと(♾)」のように、そもそも絵柄として意味が伝わらないものもある。
//
// 規格(いろはと揃える):
//   32x32 / 線は ink・太さ 2 / 角丸 / 面は彩度を落とした色
// 面の色に琥珀(--accent)は使わない。選んでいるボタンの地が琥珀なので、
// 同じ色を塗ると絵が消える。

const INK = "#443a5e";
const WHITE = "#ffffff";
const PLUM = "#a48fd0";
const SKY = "#7cc7ee";
const ROSE = "#e8a3c2";
const LEAF = "#9ed08f";
const SAND = "#e8d6b0";

/** すべてのアイコンに共通の書き出し。 */
function svg(body: string): string {
  return `<svg class="icon" viewBox="0 0 32 32" aria-hidden="true" fill="none"
    stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export const ICONS: Record<string, string> = {
  // ---- 再生まわり ----
  play: svg(`<path d="M12 8l13 8-13 8z" fill="${LEAF}"/>`),
  pause: svg(`<rect x="10" y="8" width="4.5" height="16" rx="1.5" fill="${SKY}"/>
    <rect x="17.5" y="8" width="4.5" height="16" rx="1.5" fill="${SKY}"/>`),
  stop: svg(`<rect x="9" y="9" width="14" height="14" rx="2.5" fill="${ROSE}"/>`),
  record: svg(`<circle cx="16" cy="16" r="7" fill="#e0526a" stroke="${INK}"/>`),

  // ---- 速さ。遅い→速いが一目で並ぶよう、亀・歩く人・走る人にする ----
  turtle: svg(`<path d="M9 21v4M14 22v4M19 22v4M24 21v3"/>
    <path d="M6 21a10 7 0 0 1 20 0z" fill="${LEAF}"/>
    <path d="M11 21a5 4 0 0 1 10 0" stroke-width="1.4"/>
    <path d="M26 19.5c2.6-.4 4 .7 4 1.8s-1.4 1.9-3.4 1.7"/>
    <circle cx="28.4" cy="20.6" r="0.7" fill="${INK}" stroke="none"/>
    <path d="M6 21.5c-1.6 0-2.6.7-3 1.6"/>`),
  walk: svg(`<circle cx="17" cy="7" r="3" fill="${SAND}"/>
    <path d="M17 11v7M17 18l-3 8M17 18l4 7M17 13l-5 3M17 13l5 2"/>`),
  run: svg(`<circle cx="20" cy="7" r="3" fill="${SAND}"/>
    <path d="M19 11l-3 6M16 17l-5 3M16 17l4 4M20 21l-1 6M16 13l6 1M6 15h4M5 20h4"/>`),

  // ---- くりかえし・位置 ----
  loop: svg(`<path d="M8 14a6 6 0 0 1 6-6h10"/><path d="M21 5l3 3-3 3"/>
    <path d="M24 18a6 6 0 0 1-6 6H8"/><path d="M11 27l-3-3 3-3"/>`),
  cross: svg(`<path d="M10 10l12 12M22 10L10 22" stroke-width="3"/>`),
  pin: svg(`<path d="M16 28s7-8 7-13a7 7 0 1 0-14 0c0 5 7 13 7 13z" fill="${ROSE}"/>
    <circle cx="16" cy="15" r="2.6" fill="${WHITE}"/>`),

  // ---- タブ ----
  film: svg(`<rect x="5" y="12" width="22" height="15" rx="2.5" fill="${WHITE}"/>
    <path d="M5 12l3-6 20 3-1 3" fill="${PLUM}"/><path d="M12 7l2 5M19 8l2 5"/>`),
  sparkle: svg(`<path d="M16 4l2.6 7.4L26 14l-7.4 2.6L16 24l-2.6-7.4L6 14l7.4-2.6z" fill="${SAND}"/>
    <path d="M25 21l1 2.6 2.6 1-2.6 1L25 28l-1-2.4-2.6-1 2.6-1z" fill="${SAND}"/>`),
  target: svg(`<circle cx="16" cy="16" r="11" fill="${WHITE}"/>
    <circle cx="16" cy="16" r="6.5" fill="${ROSE}"/>
    <circle cx="16" cy="16" r="2.2" fill="${INK}" stroke="none"/>`),
  drum: svg(`<ellipse cx="16" cy="12" rx="10" ry="4" fill="${WHITE}"/>
    <path d="M6 12v8c0 2.2 4.5 4 10 4s10-1.8 10-4v-8" fill="${ROSE}"/>
    <path d="M6 12c0 2.2 4.5 4 10 4s10-1.8 10-4"/>
    <path d="M22 6l5-3M25 9l4-1"/>`),

  // ---- おだいの出しかた ----
  bulb: svg(`<path d="M16 5a7 7 0 0 0-4 12.8V21h8v-3.2A7 7 0 0 0 16 5z" fill="${SAND}"/>
    <path d="M13 24h6M14 27h4"/>`),
  // 文字。ドレミの「ド」を出すのがいちばん早い(このアプリの文字のおだいは音名だけ)。
  letter: svg(`<rect x="4" y="6" width="24" height="20" rx="4" fill="${WHITE}"/>
    <text x="16" y="17" font-size="13" font-weight="700" text-anchor="middle"
      dominant-baseline="central" fill="${INK}" stroke="none"
      font-family="inherit">ド</text>`),
  ear: svg(`<path d="M22 13a7 7 0 1 0-13.4 3c1 2.2 1.4 3.6.6 5.4-.8 1.8.4 3.6 2.4 3.6
      2.2 0 3-1.6 3.4-3.4.5-2.2 1.6-3 3.2-4A6 6 0 0 0 22 13z" fill="${SAND}"/>
    <path d="M13 14a3.4 3.4 0 0 1 6.4 1.4c0 2-2 2.6-2.6 4.4"/>`),
  staff: svg(`<path d="M3 8h26M3 13h26M3 18h26M3 23h26M3 28h26" stroke-width="1.5"/>
    <ellipse cx="17" cy="23" rx="4" ry="3" fill="${PLUM}" transform="rotate(-18 17 23)"/>
    <path d="M20.8 22V7" stroke-width="1.8"/>`),

  // ---- やり方 ----
  infinity: svg(`<path d="M16 16c-2.5-3.6-4.4-5-6.6-5a5 5 0 0 0 0 10c2.2 0 4.1-1.4 6.6-5z" fill="${SKY}"/>
    <path d="M16 16c2.5 3.6 4.4 5 6.6 5a5 5 0 0 0 0-10c-2.2 0-4.1 1.4-6.6 5z" fill="${SKY}"/>`),
  burst: svg(`<path d="M16 3l3 6 6-3-2 6 6 1-5 3 4 5-6-1-1 6-5-4-5 4-1-6-6 1 4-5-5-3 6-1-2-6 6 3z"
    fill="${ROSE}"/>`),
  undo: svg(`<path d="M7 16a9 9 0 1 0 3-6.7"/><path d="M6 6v6h6"/>`),

  // ---- 道具 ----
  speaker: svg(`<path d="M6 13h5l6-5v16l-6-5H6z" fill="${SKY}"/>
    <path d="M21 12.5a6 6 0 0 1 0 7"/><path d="M24.5 9a11 11 0 0 1 0 14"/>`),
  tap: svg(`<path d="M14 17V8a2.2 2.2 0 0 1 4.4 0v7"/>
    <path d="M18.4 13.5a2 2 0 0 1 4 0v2M22.4 15a2 2 0 0 1 4 0v5c0 4-3 7-7 7h-2c-3 0-4.5-2-6-5l-2.5-4.5
      a2 2 0 0 1 3.4-2L14 20" fill="${SAND}"/>`),
  keyboard: svg(`<rect x="3" y="9" width="26" height="15" rx="2" fill="${WHITE}"/>
    <path d="M10 9v15M16 9v15M22 9v15" stroke-width="1.6"/>
    <rect x="7.5" y="9" width="4" height="8" rx="1" fill="${INK}" stroke="none"/>
    <rect x="13.5" y="9" width="4" height="8" rx="1" fill="${INK}" stroke="none"/>
    <rect x="20" y="9" width="4" height="8" rx="1" fill="${INK}" stroke="none"/>`),
  mic: svg(`<rect x="12" y="4" width="8" height="14" rx="4" fill="${PLUM}"/>
    <path d="M8 15a8 8 0 0 0 16 0M16 23v4M12 27h8"/>`),
  note: svg(`<ellipse cx="11" cy="23" rx="4" ry="3.2" fill="${PLUM}" transform="rotate(-18 11 23)"/>
    <ellipse cx="23" cy="20" rx="4" ry="3.2" fill="${PLUM}" transform="rotate(-18 23 20)"/>
    <path d="M14.6 22V7l12-2.4v15"/><path d="M14.6 11l12-2.4"/>`),
  print: svg(`<path d="M9 12V5h14v7" fill="${WHITE}"/>
    <rect x="4" y="12" width="24" height="10" rx="2" fill="${SKY}"/>
    <rect x="9" y="19" width="14" height="9" rx="1.5" fill="${WHITE}"/>`),
  trash: svg(`<path d="M12 6l1-2h6l1 2"/>
    <rect x="6" y="6" width="20" height="4" rx="2" fill="${ROSE}"/>
    <path d="M8.5 10h15l-1.5 15a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2z" fill="${WHITE}"/>
    <path d="M14 14v8M18 14v8" stroke-width="1.8"/>`),

  // ---- 向き ----
  left: svg(`<path d="M19 6L9 16l10 10" stroke-width="3"/>`),
  right: svg(`<path d="M13 6l10 10-10 10" stroke-width="3"/>`),
  up: svg(`<path d="M16 27V7M8 15l8-8 8 8" stroke-width="3"/>`),
  down: svg(`<path d="M16 5v20M8 17l8 8 8-8" stroke-width="3"/>`),

  // ---- 全画面 ----
  fullscreen: svg(`<path d="M6 12V6h6M20 6h6v6M26 20v6h-6M12 26H6v-6" stroke-width="2.6"/>`),
  fullscreenExit: svg(`<path d="M12 6v6H6M26 12h-6V6M20 26v-6h6M6 20h6v6" stroke-width="2.6"/>`),

  // ---- 合否 ----
  circleMark: svg(`<circle cx="16" cy="16" r="12.5" stroke="#c4304a" stroke-width="3.4"/>
    <circle cx="16" cy="16" r="6.5" stroke="#c4304a" stroke-width="3.4"/>`),
  crossMark: svg(`<path d="M7 7l18 18M25 7L7 25" stroke="#c4304a" stroke-width="4.2"/>`),
};

/** 名前からアイコンの SVG を返す。無い名前は空文字（描かない）。 */
export function icon(name: string): string {
  return ICONS[name] ?? "";
}

/**
 * `data-icon` が付いた要素の先頭にアイコンを差し込む。
 * HTML に SVG を直接書くと読めなくなるので、印だけ置いてここで埋める。
 */
export function mountIcons(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>("[data-icon]")) {
    const name = el.dataset.icon;
    if (!name || el.querySelector(".icon")) continue;
    el.insertAdjacentHTML("afterbegin", icon(name));
  }
}
