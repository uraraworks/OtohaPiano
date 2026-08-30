// 入門の練習課題。
//
// なぜ曲を収録せず、課題を組み立てるのか:
//   曲は誰かの作品なので、たとえ自分で弾いた打鍵記録でも楽曲そのものの権利が残る。
//   一方このファイルが作るのは音階・5 指ポジション・3 度・和音・リズムといった
//   「練習の型」で、これは特定の誰かが書いた作品ではない。データとして曲を持たず
//   規則から組み立てることで、権利の問題が起きようのない形にしてある。
//   同時に、移調・速度・くりかえしを引数で変えられるという実利もある。
//
// 出力は打鍵記録(Take)と同じ NoteEvent[]。したがって光る鍵盤・流れるドレミ・
// 速度変更は、そのための追加コードなしでそのまま効く。
//
// 資格を持つ人が作る教則ではないので、運指や姿勢には踏み込まない。
// 「鳴らす音とタイミングを合わせる」ことだけを扱う。

import type { NoteEvent } from "./takes.ts";

export interface ExerciseStep {
  /** 開始音からの半音差。2 つ以上なら同時に押す(和音)。 */
  offsets: number[];
  /** 長さ(拍)。メトロノームの拍と同じ単位。 */
  beats: number;
}

export interface Exercise {
  id: string;
  name: string;
  /** 何のための課題か。1 行で。 */
  aim: string;
  /**
   * 鍵盤の左端(ド)からの半音差で表した開始音。
   * 絶対音高で持たないので、オクターブを動かしても課題が画面の外へ出ない。
   */
  rootOffset: number;
  steps: ExerciseStep[];
}

/** 長調の音階を半音差で表したもの。ド=0 から 1 オクターブ上のド=12 まで。 */
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12] as const;

/** 音階の n 番目(0 起点)を半音差に直す。8 以上は 1 オクターブ上へ回す。 */
function deg(n: number): number {
  const octave = Math.floor(n / 7);
  const within = ((n % 7) + 7) % 7;
  return MAJOR[within]! + octave * 12;
}

/** 単音を順に並べる。 */
function line(degrees: number[], beats = 1): ExerciseStep[] {
  return degrees.map((d) => ({ offsets: [deg(d)], beats }));
}

/** 同時に押す音。 */
function chord(degrees: number[], beats = 2): ExerciseStep {
  return { offsets: degrees.map(deg), beats };
}

/** 上がって下がる並び(折り返しの音は重ねない)。 */
function upDown(from: number, to: number): number[] {
  const up: number[] = [];
  for (let d = from; d <= to; d++) up.push(d);
  const down = [...up].reverse().slice(1);
  return [...up, ...down];
}

/**
 * やさしい順に並べた課題。
 * 一度に覚えることを 1 つに絞る(音を増やす・とばす・重ねる・リズムを変える・
 * 場所を変える、を混ぜない)。
 */
export const EXERCISES: Exercise[] = [
  {
    id: "find-c",
    name: "ドの ばしょ",
    aim: "いちばん左の ド を、見ないで押せるようにする",
    rootOffset: 0,
    steps: line([0, 0, 0, 0], 1),
  },
  {
    id: "three-notes",
    name: "ドレミ",
    aim: "となりの音へ、指をずらして動く",
    rootOffset: 0,
    steps: line(upDown(0, 2), 1),
  },
  {
    id: "five-finger",
    name: "ドレミファソ",
    aim: "5 本の指を置いたまま、上がって下がる",
    rootOffset: 0,
    steps: line(upDown(0, 4), 1),
  },
  {
    id: "thirds",
    name: "ひとつ とばし",
    aim: "となりではない音へ跳ぶ（ドミ・レファ・ミソ）",
    rootOffset: 0,
    steps: line([0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7], 1),
  },
  {
    id: "scale-octave",
    name: "ドから ドまで",
    aim: "1 オクターブを 上がって下がる",
    rootOffset: 0,
    steps: line(upDown(0, 7), 1),
  },
  {
    id: "chords",
    name: "かさねる",
    aim: "3 つの音を 同時に押す",
    rootOffset: 0,
    steps: [chord([0, 2, 4]), chord([3, 5, 7]), chord([4, 6, 8]), chord([0, 2, 4])],
  },
  {
    id: "rhythm",
    name: "リズム",
    aim: "同じ音で、長さを 弾き分ける",
    rootOffset: 0,
    // 4 分 → 8 分 → 2 分。長さだけが変わり、音は動かない。
    steps: [
      ...line([0, 0, 0, 0], 1),
      ...line([0, 0, 0, 0, 0, 0, 0, 0], 0.5),
      ...line([0, 0], 2),
    ],
  },
  {
    id: "octave-both",
    name: "たかいドと ひくいド",
    aim: "はなれた 2 つの音を 同時に押す",
    rootOffset: 0,
    steps: [chord([0, 7]), chord([1, 8]), chord([2, 9]), chord([0, 7])],
  },
  {
    id: "from-fa",
    name: "ファから はじめる",
    aim: "同じ形を、ちがう ばしょで弾く",
    rootOffset: 5,
    steps: line(upDown(0, 4), 1),
  },
  {
    id: "from-so",
    name: "ソから はじめる",
    aim: "同じ形を、さらに ちがう ばしょで弾く",
    rootOffset: 7,
    steps: line(upDown(0, 4), 1),
  },
];

/**
 * 課題を打鍵記録と同じ形へ展開する。
 * @param baseMidi 鍵盤の左端(ド)の MIDI 番号。
 * @param bpm メトロノームと同じ速さ。
 */
export function toNoteEvents(ex: Exercise, baseMidi: number, bpm: number): NoteEvent[] {
  const secPerBeat = 60 / Math.max(1, bpm);
  const events: NoteEvent[] = [];
  let at = 0;
  for (const step of ex.steps) {
    const len = step.beats * secPerBeat;
    for (const offset of step.offsets) {
      // 次の音との間にわずかな切れ目を作る。繋がって聞こえると数えられない。
      events.push({ midi: baseMidi + ex.rootOffset + offset, at, dur: len * 0.85 });
    }
    at += len;
  }
  return events;
}

/**
 * 待ちながら進む練習で使う、1 手ずつの「押すべき鍵」。
 * 時間の情報を落としてあるのが要点。急かさずに待てる。
 */
export function toKeySteps(ex: Exercise, baseMidi: number): number[][] {
  return ex.steps.map((step) => step.offsets.map((o) => baseMidi + ex.rootOffset + o));
}

/** 課題全体の長さ(拍)。一覧に出す目安。 */
export function totalBeats(ex: Exercise): number {
  return ex.steps.reduce((sum, s) => sum + s.beats, 0);
}

// ---- ランダム出題 ----------------------------------------------------------
//
// 曲の形をしていなくてよく、「光った鍵を押す」だけを繰り返す遊び方。
// 決まった並びを覚えてしまうと指が勝手に動くようになるが、それは
// 「音を見て押す」練習にはならない。毎回変わる出題がそこを埋める。
// 出題も規則から作るので、やはり権利の問題は生じない。

export interface RandomLevel {
  id: string;
  name: string;
  aim: string;
  /** 使う音(開始音からの音階上の番号)。 */
  pool: number[];
  /** 同時に押す音の数。2 以上なら和音を混ぜる。 */
  maxChord: number;
}

export const RANDOM_LEVELS: RandomLevel[] = [
  { id: "r3", name: "3つの音から", aim: "ドレミ の 3 つ", pool: [0, 1, 2], maxChord: 1 },
  { id: "r5", name: "5つの音から", aim: "ドレミファソ の 5 つ", pool: [0, 1, 2, 3, 4], maxChord: 1 },
  { id: "r8", name: "1オクターブから", aim: "ド から ド までの 8 つ", pool: [0, 1, 2, 3, 4, 5, 6, 7], maxChord: 1 },
  { id: "rc", name: "かさなる音も", aim: "ときどき 2 つ同時に鳴る", pool: [0, 1, 2, 3, 4, 5, 6, 7], maxChord: 2 },
];

/**
 * ランダムな出題を作る。
 * @param rng 0 以上 1 未満を返す関数。テストから固定できるよう引数で受け取る
 *            (ここで Math.random を直接呼ぶと出題を検証できない)。
 * @param count 何手ぶん出すか。
 */
export function makeRandomExercise(level: RandomLevel, count: number, rng: () => number): Exercise {
  const steps: ExerciseStep[] = [];
  let prev: number | null = null;
  for (let i = 0; i < count; i++) {
    const pick = (): number => level.pool[Math.floor(rng() * level.pool.length)] ?? 0;
    let d = pick();
    // 同じ音が続くと「押しっぱなしでよい」と誤解されるので、1 回だけ引き直す。
    if (d === prev) d = pick();
    prev = d;
    const degrees = [d];
    if (level.maxChord > 1 && rng() < 0.3) {
      // 和音は 3 度上を重ねる。適当な 2 音より、耳に馴染む形にする。
      degrees.push(d + 2);
    }
    steps.push({ offsets: degrees.map(deg), beats: 1 });
  }
  return {
    id: `random-${level.id}`,
    name: `${level.name}（ランダム）`,
    aim: level.aim,
    rootOffset: 0,
    steps,
  };
}
