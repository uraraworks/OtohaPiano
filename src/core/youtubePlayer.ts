// YouTube IFrame Player API の薄いラッパ。
//
// 方針:
// - 映像は必ず表示する(音だけの再生は利用規約で不可。原体験も「見ながら弾く」)。
// - A-B リピートは API にその機能が無いので、こちらで再生位置を監視して巻き戻す。
// - 打鍵記録が動画の時刻に紐づくので、「今の再生位置」は 1 か所からだけ取れるようにする。

const API_SRC = "https://www.youtube.com/iframe_api";

/** IFrame API のうち、このアプリが実際に触る部分だけの型。 */
interface YTPlayer {
  loadVideoById(id: string, start?: number): void;
  cueVideoById(id: string, start?: number): void;
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number; CUED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

/** IFrame API スクリプトを 1 回だけ読み込む。 */
function loadApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve, reject) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    // API は読み込み完了をグローバル関数で知らせてくる。既存の登録は潰さない。
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const script = document.createElement("script");
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => reject(new Error("YouTube の再生機能を読み込めませんでした"));
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface AbLoop {
  start: number;
  end: number;
}

export type PlayerStatus = "idle" | "playing" | "paused" | "ended";

export class VideoPlayer {
  private player: YTPlayer | null = null;
  private timer: number | null = null;
  private loop: AbLoop | null = null;
  private currentId: string | null = null;
  private rate = 1;

  /** 再生位置が動いたときに呼ばれる(毎フレームではなく 100ms 間隔)。 */
  onTick: ((current: number, duration: number) => void) | null = null;
  onStatus: ((status: PlayerStatus) => void) | null = null;

  async mount(container: HTMLElement): Promise<void> {
    await loadApi();
    const YT = window.YT;
    if (!YT) throw new Error("YouTube の再生機能を読み込めませんでした");
    await new Promise<void>((resolve) => {
      this.player = new YT.Player(container, {
        width: "100%",
        height: "100%",
        playerVars: {
          // 関連動画を自分のチャンネル内に閉じ、子供が別の動画へ飛ばないようにする。
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
        },
        events: {
          onReady: () => resolve(),
          onStateChange: (e: { data: number }) => {
            const S = YT.PlayerState;
            if (e.data === S.PLAYING) this.onStatus?.("playing");
            else if (e.data === S.PAUSED) this.onStatus?.("paused");
            else if (e.data === S.ENDED) this.onStatus?.("ended");
          },
        },
      });
    });
    this.startTicking();
  }

  get mounted(): boolean {
    return this.player !== null;
  }

  get videoId(): string | null {
    return this.currentId;
  }

  load(videoId: string, startSeconds = 0): void {
    this.currentId = videoId;
    this.loop = null;
    // cue にすると子供のタップ 1 回ぶん操作が増えるので、選んだら再生まで行く。
    this.player?.loadVideoById(videoId, startSeconds);
    this.player?.setPlaybackRate(this.rate);
  }

  play(): void {
    this.player?.playVideo();
  }

  pause(): void {
    this.player?.pauseVideo();
  }

  seek(seconds: number): void {
    this.player?.seekTo(Math.max(0, seconds), true);
  }

  currentTime(): number {
    const t = this.player?.getCurrentTime();
    return typeof t === "number" && Number.isFinite(t) ? t : 0;
  }

  duration(): number {
    const d = this.player?.getDuration();
    return typeof d === "number" && Number.isFinite(d) ? d : 0;
  }

  isPlaying(): boolean {
    const S = window.YT?.PlayerState;
    return S !== undefined && this.player?.getPlayerState() === S.PLAYING;
  }

  /**
   * 再生速度。YouTube のスローはピッチを保つので、
   * 遅くしてもキー(音の高さ)が変わらない＝そのまま鍵盤で合わせられる。
   */
  setRate(rate: number): void {
    this.rate = rate;
    this.player?.setPlaybackRate(rate);
  }

  getRate(): number {
    return this.rate;
  }

  setLoop(loop: AbLoop | null): void {
    // start > end で渡されても壊れないように直しておく。
    if (loop && loop.end - loop.start < 0.3) {
      this.loop = null;
      return;
    }
    this.loop = loop ? { start: Math.min(loop.start, loop.end), end: Math.max(loop.start, loop.end) } : null;
  }

  getLoop(): AbLoop | null {
    return this.loop;
  }

  private startTicking(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => {
      if (!this.player) return;
      const cur = this.currentTime();
      // A-B リピート: 終点を越えたら始点へ戻す。
      // 速度 0.5 でも取りこぼさないよう 100ms 間隔で見る。
      const loop = this.loop;
      if (loop && this.isPlaying() && cur >= loop.end) {
        this.seek(loop.start);
        this.onTick?.(loop.start, this.duration());
        return;
      }
      this.onTick?.(cur, this.duration());
    }, 100);
  }

  destroy(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.player?.destroy();
    this.player = null;
  }
}
