// 画面下の鍵盤。
//
// マルチタッチは Pointer Events で扱う。和音・連打が要件なので
// 「1 本の指 = 1 つの鍵」を pointerId で追いかけ、指が別の鍵へ滑ったら
// 前の鍵を離して次の鍵を押す(グリッサンドが自然に鳴る)。

import { buildKeyLayout, noteNameJa, type KeyLayoutItem } from "../core/notes.ts";

export interface KeyboardOptions {
  /** 左端の MIDI 番号(必ず C)。 */
  startMidi: number;
  /** 白鍵の数。 */
  whiteCount: number;
  onNoteOn: (midi: number) => void;
  onNoteOff: (midi: number) => void;
}

export class Keyboard {
  private root: HTMLElement;
  private opts: KeyboardOptions;
  private keyEls = new Map<number, HTMLElement>();
  /** 指(pointerId) → 今押している鍵。指が滑ったときの差し替えに使う。 */
  private touching = new Map<number, number>();
  /** お手本(光る鍵盤)で光らせている鍵。指の押下とは別に数える。 */
  private guided = new Set<number>();
  private showNames = true;

  constructor(root: HTMLElement, opts: KeyboardOptions) {
    this.root = root;
    this.opts = opts;
    this.render();
    this.bind();
  }

  setRange(startMidi: number, whiteCount: number): void {
    this.releaseAll();
    this.opts.startMidi = startMidi;
    this.opts.whiteCount = whiteCount;
    this.render();
  }

  getStartMidi(): number {
    return this.opts.startMidi;
  }

  setShowNames(show: boolean): void {
    this.showNames = show;
    this.root.classList.toggle("kb-no-names", !show);
  }

  private render(): void {
    const layout = buildKeyLayout(this.opts.startMidi, this.opts.whiteCount);
    const whites = layout.filter((k) => !k.black).length;
    this.root.innerHTML = "";
    this.keyEls.clear();
    // 白鍵の幅を CSS 変数で配り、黒鍵の位置もこの 1 つの値から決める。
    this.root.style.setProperty("--white-count", String(whites));
    for (const k of layout) {
      this.root.appendChild(this.makeKey(k));
    }
    this.root.classList.toggle("kb-no-names", !this.showNames);
  }

  private makeKey(k: KeyLayoutItem): HTMLElement {
    const el = document.createElement("div");
    el.className = k.black ? "key key-black" : "key key-white";
    el.dataset.midi = String(k.midi);
    if (k.black) {
      // 黒鍵は「直前の白鍵の右端」にまたがる。白鍵幅を単位にして置く。
      el.style.left = `calc(var(--white-w) * ${k.whiteIndex + 1} - var(--black-w) / 2)`;
    } else {
      el.style.left = `calc(var(--white-w) * ${k.whiteIndex})`;
      const label = document.createElement("span");
      label.className = "key-label";
      // 鍵盤にはドレミだけを書く。今どのオクターブにいるかは道具バーの表示(C4 等)で分かるので、
      // 鍵盤の上で英語音名と混ぜない。
      label.textContent = noteNameJa(k.midi);
      el.appendChild(label);
    }
    this.keyEls.set(k.midi, el);
    return el;
  }

  private midiAt(x: number, y: number): number | null {
    // 黒鍵は白鍵の上に重なっているので、座標から引けば自然に黒鍵が優先される。
    const el = document.elementFromPoint(x, y);
    const key = el?.closest<HTMLElement>(".key");
    if (!key || !this.root.contains(key)) return null;
    const midi = Number(key.dataset.midi);
    return Number.isFinite(midi) ? midi : null;
  }

  private bind(): void {
    const down = (e: PointerEvent): void => {
      const midi = this.midiAt(e.clientX, e.clientY);
      if (midi === null) return;
      // 押している間ずっとこの要素にイベントを届かせる(指が外れても離鍵を取りこぼさない)。
      this.root.setPointerCapture(e.pointerId);
      e.preventDefault();
      this.press(e.pointerId, midi);
    };

    const move = (e: PointerEvent): void => {
      if (!this.touching.has(e.pointerId)) return;
      const midi = this.midiAt(e.clientX, e.clientY);
      const current = this.touching.get(e.pointerId)!;
      if (midi === current) return;
      this.release(e.pointerId);
      if (midi !== null) this.press(e.pointerId, midi);
    };

    const up = (e: PointerEvent): void => {
      this.release(e.pointerId);
    };

    this.root.addEventListener("pointerdown", down);
    this.root.addEventListener("pointermove", move);
    this.root.addEventListener("pointerup", up);
    this.root.addEventListener("pointercancel", up);
    // 指が画面外へ出たまま離されるケース。押しっぱなしで鳴り続けるのを防ぐ。
    this.root.addEventListener("lostpointercapture", up);
    // 長押しの選択メニューや、二本指でのスクロールを止める。
    this.root.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  private press(pointerId: number, midi: number): void {
    this.touching.set(pointerId, midi);
    this.keyEls.get(midi)?.classList.add("key-down");
    this.opts.onNoteOn(midi);
  }

  private release(pointerId: number): void {
    const midi = this.touching.get(pointerId);
    if (midi === undefined) return;
    this.touching.delete(pointerId);
    // 同じ鍵を別の指がまだ押しているなら、見た目も音も消さない。
    if (![...this.touching.values()].includes(midi)) {
      this.keyEls.get(midi)?.classList.remove("key-down");
      this.opts.onNoteOff(midi);
    }
  }

  /**
   * 画面の外（パソコンのキーボード）から押す / 離す。
   * 指の管理と同じ仕組みに乗せるので、見た目も音も、押し直しの扱いも指と同じになる。
   * 指の pointerId と衝突しない負の番号を、鍵ごとに割り当てる。
   */
  private externalPointerId(midi: number): number {
    return -1000 - midi;
  }

  pressExternal(midi: number): void {
    if (!this.keyEls.has(midi)) return; // 画面に出ていない鍵は鳴らさない
    if (this.touching.has(this.externalPointerId(midi))) return;
    this.press(this.externalPointerId(midi), midi);
  }

  releaseExternal(midi: number): void {
    this.release(this.externalPointerId(midi));
  }

  /** 全部離す(画面切り替え・お手本の停止時)。 */
  releaseAll(): void {
    for (const id of [...this.touching.keys()]) this.release(id);
    this.clearGuide();
  }

  /** お手本の「光る鍵盤」。押下の見た目とは別クラスにして、両方同時に出せるようにする。 */
  setGuide(midi: number, on: boolean): void {
    const el = this.keyEls.get(midi);
    if (on) {
      this.guided.add(midi);
      el?.classList.add("key-guide");
    } else {
      this.guided.delete(midi);
      el?.classList.remove("key-guide");
    }
  }

  clearGuide(): void {
    for (const midi of [...this.guided]) this.setGuide(midi, false);
  }

  /** 画面に出ていない鍵が光るときのために、範囲外かどうかを返す。 */
  contains(midi: number): boolean {
    return this.keyEls.has(midi);
  }
}
