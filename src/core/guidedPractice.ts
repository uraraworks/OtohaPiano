// 待ちながら進む練習（音ゲー的な弾き方）。
//
// 時計を持たないのが要点。「次に押す鍵」を示したまま、正しく押されるまで待つ。
// テンポに追われないので、初心者がいちばん挫折しにくい。
// 速く弾く練習は、既にある速度 3 段階とメトロノームが受け持つ。
//
// 和音は「同時に」ではなく「全部そろったら」で進める。指が 1 本ずつ落ちるのが
// 普通なので、同時押しを求めると初心者には厳しすぎる。

export type PressResult =
  /** 正しい鍵だが、和音の残りがまだある。 */
  | { kind: "partial"; remaining: number[] }
  /** この手が終わって次へ進んだ。 */
  | { kind: "advance"; next: number[] }
  /** 最後まで終わった。 */
  | { kind: "done" }
  /** 求めていない鍵。進めない。 */
  | { kind: "wrong" };

export class GuidedPractice {
  private steps: number[][];
  private index = 0;
  /** 今の手で既に押せた音。和音の途中経過。 */
  private hit = new Set<number>();
  private misses = 0;
  private finished = false;

  constructor(steps: number[][]) {
    // 空の手が混ざると永久に進まなくなるので、ここで落とす。
    this.steps = steps.filter((s) => s.length > 0);
    this.finished = this.steps.length === 0;
  }

  /** 今 押すべき鍵。終わっていれば空。 */
  get current(): number[] {
    return this.finished ? [] : (this.steps[this.index] ?? []);
  }

  /** まだ押せていない鍵。光らせるのはこちら(押した音まで光り続けると分からない)。 */
  get remaining(): number[] {
    return this.current.filter((m) => !this.hit.has(m));
  }

  get done(): boolean {
    return this.finished;
  }

  /** 何手目 / 全部で何手。 */
  get progress(): { step: number; total: number } {
    return { step: Math.min(this.index + (this.finished ? 0 : 1), this.steps.length), total: this.steps.length };
  }

  /** 押し間違えた回数。責めるためではなく、やさしい課題へ戻す判断に使う。 */
  get missCount(): number {
    return this.misses;
  }

  press(midi: number): PressResult {
    if (this.finished) return { kind: "done" };
    const current = this.current;
    if (!current.includes(midi)) {
      this.misses++;
      return { kind: "wrong" };
    }
    this.hit.add(midi);
    if (this.hit.size < current.length) {
      return { kind: "partial", remaining: this.remaining };
    }
    // この手は終わり。次へ。
    this.hit.clear();
    this.index++;
    if (this.index >= this.steps.length) {
      this.finished = true;
      return { kind: "done" };
    }
    return { kind: "advance", next: this.current };
  }

  reset(): void {
    this.index = 0;
    this.hit.clear();
    this.misses = 0;
    this.finished = this.steps.length === 0;
  }
}
