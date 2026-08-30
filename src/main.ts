// 画面の組み立てと配線。
// 判断のあるロジックは core/ 側に置き、ここは「DOM とつなぐ」ことに徹する。

import "./style.css";
import { Synth, INSTRUMENTS } from "./core/synth.ts";
import { Keyboard } from "./ui/keyboard.ts";
import { MIDI_MIDDLE_C, noteNameEn, noteNameJa, octaveStartCandidates } from "./core/notes.ts";
import { VideoPlayer } from "./core/youtubePlayer.ts";
import { parseVideoId, parseStartSeconds, thumbnailUrl, formatTime } from "./core/youtubeUrl.ts";
import {
  loadLibrary,
  saveLibrary,
  addVideo,
  removeVideo,
  updateVideo,
  addMark,
  removeMark,
  fetchTitle,
  type VideoEntry,
} from "./core/library.ts";
import { TakeRecorder, loadTakes, saveTakes, takesForVideo, makeTake, type Take } from "./core/takes.ts";
import { TakePlayback } from "./core/takePlayback.ts";
import { buildDoremi, activeIndex, type DoremiItem } from "./core/doremi.ts";
import { Metronome, bpmFromTaps } from "./core/metronome.ts";
import {
  AudioMemoRecorder,
  loadMemos,
  saveMemos,
  micAvailable,
  storeMemo,
  memoUrl,
  removeMemo,
  newMemoId,
  type MemoMeta,
} from "./core/audioMemo.ts";
import { newId, loadJson, saveJson } from "./core/storage.ts";
import { isFullscreenSupported, isFullscreenActive, toggleFullscreen, onFullscreenChange } from "./core/fullscreen.ts";
import { DRILL_LEVELS, makeDrillSteps, type DrillLevel } from "./core/drills.ts";
import { GuidedPractice } from "./core/guidedPractice.ts";

/** 型付きで要素を引く。無ければ組み立てのミスなので即座に落とす。 */
function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`要素が見つかりません: #${id}`);
  return el as T;
}

let toastTimer = 0;
function toast(message: string): void {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.hidden = true;
  }, 2200);
}

// ---- 状態 -----------------------------------------------------------------

const synth = new Synth();
const player = new VideoPlayer();
const metronome = new Metronome(synth);
const keyRecorder = new TakeRecorder();
const memoRecorder = new AudioMemoRecorder();

let library: VideoEntry[] = loadLibrary();
let takes: Take[] = loadTakes();
let memos: MemoMeta[] = loadMemos();
let currentVideo: VideoEntry | null = null;
let whiteCount = 14;
let startMidi = MIDI_MIDDLE_C;
/** 打鍵記録の録音中フラグ。時刻の基準が動画かどうかもここで持つ。 */
let recordingKeys = false;
let recordingVideoId: string | null = null;
/** A-B リピートの A 点。B を押すまでは仮置き。 */
let pointA: number | null = null;
let doremiItems: DoremiItem[] = [];
let doremiEls: HTMLElement[] = [];
let lastDoremiIndex = -2;
let playingTakeId: string | null = null;
/** タップテンポの打点(ミリ秒)。 */
let taps: number[] = [];
/** 再生中の音声メモ。切り替えのときに前のものを止める。 */
let memoAudio: HTMLAudioElement | null = null;
/** 出題中のドリル。null なら やっていない。 */
let practice: GuidedPractice | null = null;
let drillLevel: DrillLevel | null = null;
/** 出題の音名。もじのおだいで並べて見せる。 */
let drillLabels: string[] = [];
/** おだいの出しかた。前回選んだものを覚えておく。 */
let promptMode: PromptMode = loadJson<PromptMode>("promptMode", "letter");
let stats = { hits: 0, misses: 0, startedAt: 0 };
/** レベルごとの最高記録(音/分)。次に開いたときの目標になる。 */
const bestScores = loadJson<Record<string, number>>("best", {});

const keyboard = new Keyboard($("keyboard"), {
  startMidi,
  whiteCount,
  onNoteOn: (midi) => {
    synth.noteOn(midi);
    if (recordingKeys) keyRecorder.noteOn(midi, recordTime());
    // 練習中は、押した鍵が「次の音」かどうかを見て進める。
    if (practice) onPracticePress(midi);
  },
  onNoteOff: (midi) => {
    synth.noteOff(midi);
    if (recordingKeys) keyRecorder.noteOff(midi, recordTime());
  },
});

const takePlayback = new TakePlayback({
  onNoteOn: (midi) => synth.noteOn(midi, 0.85),
  onNoteOff: (midi) => synth.noteOff(midi),
  onGuide: (midi, on) => keyboard.setGuide(midi, on),
  onTime: (t) => updateDoremi(t),
  onEnd: () => stopTakePlayback(),
});

/**
 * 打鍵記録に刻む時刻。
 * 動画を再生しながら録っているなら動画の再生位置を使う。これが記録と動画を結びつけ、
 * 後からのシーク・くりかえし・速度変更への追従を成立させている。
 */
function recordTime(): number {
  return recordingVideoId !== null ? player.currentTime() : performance.now() / 1000;
}

// ---- 入口(音声解禁) -------------------------------------------------------

$("app-version").textContent = __APP_VERSION__;

// 全画面。iPhone の Safari は <video> 以外の全画面に対応せず、呼んでも例外すら出ずに
// 何も起きないので、対応している環境でだけボタンを出す。
if (isFullscreenSupported()) {
  const btn = $("btn-fullscreen");
  btn.hidden = false;
  btn.addEventListener("click", () => void toggleFullscreen());
  // Esc や端末の戻る操作でも全画面は解除される。表示は必ず実際の状態から作る。
  const syncFullscreenButton = (): void => {
    const active = isFullscreenActive();
    btn.textContent = active ? "⤢" : "⛶";
    btn.setAttribute("aria-label", active ? "全画面をやめる" : "全画面");
  };
  onFullscreenChange(syncFullscreenButton);
  syncFullscreenButton();
}

$("start-button").addEventListener("click", () => {
  void (async () => {
    // ここがユーザー操作の中。以降 Web Audio が使えるようになる。
    await synth.unlock();
    $("start-overlay").hidden = true;
    $<HTMLElement>("app").hidden = false;
    try {
      await player.mount($("player-mount"));
    } catch {
      // 動画が使えなくても鍵盤は弾ける。ここで止めない。
      toast("動画の しくみを 読みこめませんでした");
    }
    player.onTick = onVideoTick;
    player.onStatus = (s) => {
      $("btn-play").textContent = s === "playing" ? "⏸" : "▶";
    };
    renderLibrary();
    renderTakes();
    renderMemos();
    renderInstruments();
    renderMetroLamps();
    renderDrills();
    setPromptMode(promptMode);
    updateOctaveLabel();
  })();
});

// ---- 楽器・オクターブ・音量 ------------------------------------------------

function renderInstruments(): void {
  const group = $("instrument-group");
  group.innerHTML = "";
  for (const inst of INSTRUMENTS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctl" + (inst.id === synth.getInstrument().id ? " is-on" : "");
    btn.innerHTML = `${inst.emoji}<small>${inst.label}</small>`;
    btn.addEventListener("click", () => {
      // 楽器を切り替える瞬間に鳴っている音は、前の音色のまま残ると濁るので止める。
      synth.allNotesOff();
      synth.setInstrument(inst.id);
      renderInstruments();
    });
    group.appendChild(btn);
  }
}

function updateOctaveLabel(): void {
  $("oct-label").textContent = noteNameEn(startMidi);
}

function shiftOctave(dir: number): void {
  const candidates = octaveStartCandidates(whiteCount);
  const idx = candidates.indexOf(startMidi);
  const next = candidates[Math.max(0, Math.min(candidates.length - 1, (idx < 0 ? 2 : idx) + dir))];
  if (next === undefined || next === startMidi) return;
  startMidi = next;
  keyboard.setRange(startMidi, whiteCount);
  updateOctaveLabel();
}

$("btn-oct-down").addEventListener("click", () => shiftOctave(-1));
$("btn-oct-up").addEventListener("click", () => shiftOctave(1));

for (const btn of document.querySelectorAll<HTMLElement>(".width-btn")) {
  btn.addEventListener("click", () => {
    whiteCount = Number(btn.dataset.white);
    for (const b of document.querySelectorAll(".width-btn")) b.classList.remove("is-on");
    btn.classList.add("is-on");
    // 幅を変えると左端の候補も変わるので、収まる位置へ寄せ直す。
    const candidates = octaveStartCandidates(whiteCount);
    if (!candidates.includes(startMidi)) startMidi = candidates[candidates.length - 1] ?? MIDI_MIDDLE_C;
    keyboard.setRange(startMidi, whiteCount);
    updateOctaveLabel();
  });
}

$<HTMLInputElement>("chk-key-names").addEventListener("change", (e) => {
  keyboard.setShowNames((e.target as HTMLInputElement).checked);
});

$<HTMLInputElement>("volume").addEventListener("input", (e) => {
  synth.setVolume(Number((e.target as HTMLInputElement).value) / 100);
});

// ---- タブ ------------------------------------------------------------------

for (const tab of document.querySelectorAll<HTMLElement>(".tab")) {
  tab.addEventListener("click", () => {
    for (const t of document.querySelectorAll(".tab")) t.classList.remove("is-on");
    for (const p of document.querySelectorAll(".panel")) p.classList.remove("is-on");
    tab.classList.add("is-on");
    document.querySelector(`.panel[data-panel="${tab.dataset.tab}"]`)?.classList.add("is-on");
  });
}

// ---- ライブラリ ------------------------------------------------------------

function renderLibrary(): void {
  const list = $("video-list");
  list.innerHTML = "";
  if (library.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-note";
    li.textContent = "まだ 曲がありません。上に URL をはりつけて 追加してください。";
    list.appendChild(li);
    return;
  }
  for (const entry of library) {
    const li = document.createElement("li");
    li.className = "video-item" + (entry.id === currentVideo?.id ? " is-on" : "");

    const img = document.createElement("img");
    img.src = thumbnailUrl(entry.id);
    img.alt = "";
    // 限定公開や削除済みでサムネイルが出ないことがある。枠だけ残して一覧は崩さない。
    img.addEventListener("error", () => {
      img.style.visibility = "hidden";
    });

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = entry.title;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn";
    del.textContent = "🗑";
    del.setAttribute("aria-label", `${entry.title} を一覧から消す`);
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!confirm(`「${entry.title}」を 一覧から けしますか？`)) return;
      library = removeVideo(library, entry.id);
      saveLibrary(library);
      if (currentVideo?.id === entry.id) currentVideo = null;
      renderLibrary();
      renderTakes();
    });

    li.append(img, title, del);
    li.addEventListener("click", () => selectVideo(entry));
    list.appendChild(li);
  }
}

function selectVideo(entry: VideoEntry): void {
  stopTakePlayback();
  currentVideo = entry;
  document.querySelector(".video-pane")?.classList.remove("is-empty");
  $("video-controls").hidden = false;
  player.load(entry.id, entry.marks[0]?.time ?? 0);
  // 前回の A-B を復元する。続きから練習できることが目的。
  player.setLoop(entry.loop);
  pointA = entry.loop?.start ?? null;
  updateLoopStatus();
  renderMarks();
  renderLibrary();
  renderTakes();
  renderMemos();
}

$("btn-add").addEventListener("click", () => void addFromInput());
$<HTMLInputElement>("url-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") void addFromInput();
});

async function addFromInput(): Promise<void> {
  const input = $<HTMLInputElement>("url-input");
  const hint = $("add-hint");
  const videoId = parseVideoId(input.value);
  if (videoId === null) {
    hint.classList.add("is-error");
    hint.textContent = "YouTube の URL として よみとれませんでした。もう一度 はりつけてください。";
    return;
  }
  hint.classList.remove("is-error");
  hint.textContent = "タイトルを しらべています…";
  const startAt = parseStartSeconds(input.value);
  const title = await fetchTitle(videoId);
  const [next, entry, isNew] = addVideo(library, videoId, title);
  library = next;
  if (isNew && startAt !== null) {
    // 共有 URL に開始位置が入っていたら「ここから練習」として引き継ぐ。
    const withMark = addMark(entry, { id: newId(), time: startAt, label: formatTime(startAt) });
    library = updateVideo(library, videoId, { marks: withMark.marks });
  }
  saveLibrary(library);
  input.value = "";
  hint.textContent = isNew ? `「${title}」を 追加しました。` : `「${title}」は もう 一覧にあります。`;
  renderLibrary();
  const target = library.find((e) => e.id === videoId);
  if (target) selectVideo(target);
}

// ---- 再生コントロール ------------------------------------------------------

let seeking = false;

$("btn-play").addEventListener("click", () => {
  if (player.isPlaying()) player.pause();
  else player.play();
});

const seek = $<HTMLInputElement>("seek");
seek.addEventListener("pointerdown", () => {
  // つまみを掴んでいる間は tick で位置を書き戻さない(指と表示が喧嘩する)。
  seeking = true;
});
seek.addEventListener("change", () => {
  const dur = player.duration();
  if (dur > 0) player.seek((Number(seek.value) / 1000) * dur);
  seeking = false;
});

function onVideoTick(current: number, duration: number): void {
  if (!seeking && duration > 0) seek.value = String(Math.round((current / duration) * 1000));
  $("time-label").textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  // お手本の再生は、この 1 行で動画に追従する。
  takePlayback.onVideoTime(current);
  if (takePlayback.playing) updateDoremi(current);
}

for (const btn of document.querySelectorAll<HTMLElement>(".rate")) {
  btn.addEventListener("click", () => {
    const rate = Number(btn.dataset.rate);
    player.setRate(rate);
    takePlayback.setRate(rate);
    if (memoAudio) memoAudio.playbackRate = rate;
    for (const b of document.querySelectorAll(".rate")) b.classList.remove("is-on");
    btn.classList.add("is-on");
  });
}

$("btn-a").addEventListener("click", () => {
  pointA = player.currentTime();
  updateLoopStatus();
});

$("btn-b").addEventListener("click", () => {
  if (pointA === null) {
    toast("さきに A（ここから）を おしてね");
    return;
  }
  const b = player.currentTime();
  if (b - pointA < 0.3) {
    toast("A と B が 近すぎます");
    return;
  }
  player.setLoop({ start: pointA, end: b });
  persistLoop();
  $("btn-loop").classList.add("is-on");
  updateLoopStatus();
});

$("btn-loop").addEventListener("click", () => {
  const loop = player.getLoop();
  if (loop) {
    // 設定済みの区間を一時的に外す。A/B の値は覚えたままにする。
    player.setLoop(null);
    $("btn-loop").classList.remove("is-on");
  } else if (pointA !== null && currentVideo?.loop) {
    player.setLoop(currentVideo.loop);
    $("btn-loop").classList.add("is-on");
  } else {
    toast("A と B を きめてね");
  }
  updateLoopStatus();
});

$("btn-loop-clear").addEventListener("click", () => {
  pointA = null;
  player.setLoop(null);
  $("btn-loop").classList.remove("is-on");
  if (currentVideo) {
    library = updateVideo(library, currentVideo.id, { loop: null });
    currentVideo = { ...currentVideo, loop: null };
    saveLibrary(library);
  }
  updateLoopStatus();
});

function persistLoop(): void {
  const loop = player.getLoop();
  if (!currentVideo || !loop) return;
  library = updateVideo(library, currentVideo.id, { loop });
  currentVideo = { ...currentVideo, loop };
  saveLibrary(library);
}

function updateLoopStatus(): void {
  const loop = player.getLoop();
  const el = $("loop-status");
  if (loop) {
    el.textContent = `🔁 ${formatTime(loop.start)} 〜 ${formatTime(loop.end)} を くりかえし`;
  } else if (pointA !== null) {
    el.textContent = `A = ${formatTime(pointA)}（B を おすと くりかえし はじまります）`;
  } else {
    el.textContent = "";
  }
}

// ---- ここを おぼえる(位置記録) ---------------------------------------------

$("btn-mark").addEventListener("click", () => {
  if (!currentVideo) return;
  const time = player.currentTime();
  const updated = addMark(currentVideo, { id: newId(), time, label: formatTime(time) });
  library = updateVideo(library, currentVideo.id, { marks: updated.marks });
  currentVideo = updated;
  saveLibrary(library);
  renderMarks();
  toast(`${formatTime(time)} を おぼえました`);
});

function renderMarks(): void {
  const list = $("mark-list");
  list.innerHTML = "";
  if (!currentVideo) return;
  for (const mark of currentVideo.marks) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mark";
    btn.innerHTML = `📍 ${mark.label} <span class="del">✕</span>`;
    btn.addEventListener("click", (e) => {
      if (!currentVideo) return;
      if ((e.target as HTMLElement).classList.contains("del")) {
        const updated = removeMark(currentVideo, mark.id);
        library = updateVideo(library, currentVideo.id, { marks: updated.marks });
        currentVideo = updated;
        saveLibrary(library);
        renderMarks();
        return;
      }
      player.seek(mark.time);
      player.play();
    });
    list.appendChild(btn);
  }
}

// ---- おてほん(打鍵記録) ----------------------------------------------------

$("btn-rec-keys").addEventListener("click", () => {
  if (recordingKeys) finishKeyRecording();
  else startKeyRecording();
});

function startKeyRecording(): void {
  stopTakePlayback();
  // 動画を再生中なら動画時刻で刻む。止まっているなら単体の記録にする。
  recordingVideoId = currentVideo && player.isPlaying() ? currentVideo.id : null;
  keyRecorder.start(recordTime());
  recordingKeys = true;
  const btn = $("btn-rec-keys");
  btn.classList.add("is-recording");
  btn.textContent = "■ ろくおんを おわる";
  $("rec-status").textContent =
    recordingVideoId !== null ? "動画に あわせて ろくおん中…" : "ろくおん中…（動画なし）";
}

function finishKeyRecording(): void {
  recordingKeys = false;
  const result = keyRecorder.finish(recordTime());
  const btn = $("btn-rec-keys");
  btn.classList.remove("is-recording");
  btn.innerHTML = "● <ruby>打鍵<rt>だけん</rt></ruby>を ろくおん";
  $("rec-status").textContent = "";
  if (!result) {
    toast("けんばんが おされませんでした");
    recordingVideoId = null;
    return;
  }
  const label = new Date().toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const take = makeTake(label, recordingVideoId, synth.getInstrument().id, result.events, result.duration);
  takes = [take, ...takes];
  if (!saveTakes(takes)) toast("ほぞんできませんでした（あきが たりません）");
  recordingVideoId = null;
  renderTakes();
  toast(`おてほんを ${result.events.length} 音 ほぞんしました`);
}

function renderTakes(): void {
  const list = $("take-list");
  list.innerHTML = "";
  // 今の曲のお手本を先に、動画なしのものを後ろに出す。
  const shown = [...takesForVideo(takes, currentVideo?.id ?? null), ...takesForVideo(takes, null)];
  const unique = shown.filter((t, i) => shown.indexOf(t) === i);
  if (unique.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-note";
    li.textContent = "まだ おてほんが ありません。";
    list.appendChild(li);
    return;
  }
  for (const take of unique) {
    const li = document.createElement("li");
    li.className = "take-item" + (take.id === playingTakeId ? " is-playing" : "");

    const play = document.createElement("button");
    play.type = "button";
    play.className = "icon-btn";
    play.textContent = take.id === playingTakeId ? "■" : "▶";
    play.addEventListener("click", () => {
      if (take.id === playingTakeId) stopTakePlayback();
      else startTakePlayback(take);
    });

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = take.name;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = `${take.events.length}音 / ${take.videoId ? "動画つき" : "単体"}`;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn";
    del.textContent = "🗑";
    del.setAttribute("aria-label", `${take.name} を消す`);
    del.addEventListener("click", () => {
      if (!confirm("この おてほんを けしますか？")) return;
      if (take.id === playingTakeId) stopTakePlayback();
      takes = takes.filter((t) => t.id !== take.id);
      saveTakes(takes);
      renderTakes();
    });

    li.append(play, name, meta, del);
    list.appendChild(li);
  }
}

function startTakePlayback(take: Take): void {
  playingTakeId = take.id;
  takePlayback.setSounding($<HTMLInputElement>("chk-take-sound").checked);
  takePlayback.setLighting($<HTMLInputElement>("chk-take-light").checked);
  // 記録した楽器に戻す。別の音色で再生すると「お手本」として別物になる。
  synth.setInstrument(take.instrument);
  renderInstruments();

  if (take.videoId !== null) {
    if (currentVideo?.id !== take.videoId) {
      const entry = library.find((e) => e.id === take.videoId);
      if (entry) selectVideo(entry);
      playingTakeId = take.id;
    }
    takePlayback.startWithVideo(take, player.currentTime(), player.getRate());
    player.play();
  } else {
    takePlayback.startStandalone(take, player.getRate());
  }

  prepareDoremi(take);
  renderTakes();
}

function stopTakePlayback(): void {
  takePlayback.stop();
  keyboard.clearGuide();
  playingTakeId = null;
  $("doremi").hidden = true;
  doremiItems = [];
  doremiEls = [];
  lastDoremiIndex = -2;
  renderTakes();
}

// ---- 流れるドレミ ----------------------------------------------------------

function prepareDoremi(take: Take): void {
  if (!$<HTMLInputElement>("chk-doremi").checked) {
    $("doremi").hidden = true;
    return;
  }
  doremiItems = buildDoremi(take.events);
  const track = $("doremi-track");
  track.innerHTML = "";
  doremiEls = doremiItems.map((item) => {
    const el = document.createElement("span");
    el.className = "doremi-item";
    el.textContent = item.text;
    el.title = item.en;
    track.appendChild(el);
    return el;
  });
  lastDoremiIndex = -2;
  $("doremi").hidden = doremiItems.length === 0;
}

function updateDoremi(time: number): void {
  if (doremiEls.length === 0) return;
  const idx = activeIndex(doremiItems, time);
  if (idx === lastDoremiIndex) return;
  lastDoremiIndex = idx;
  doremiEls.forEach((el, i) => {
    el.classList.toggle("is-now", i === idx);
    el.classList.toggle("is-past", i < idx);
  });
  // 今の音が画面の中央に来るよう横スクロールする(カラオケ字幕と同じ挙動)。
  doremiEls[idx]?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
}

$("btn-print").addEventListener("click", () => window.print());

for (const id of ["chk-take-sound", "chk-take-light"]) {
  $<HTMLInputElement>(id).addEventListener("change", () => {
    takePlayback.setSounding($<HTMLInputElement>("chk-take-sound").checked);
    takePlayback.setLighting($<HTMLInputElement>("chk-take-light").checked);
  });
}

// ---- 音声録音メモ ----------------------------------------------------------

// マイクが無い端末では、押しても失敗するボタンを見せない(企画書の指定)。
if (!micAvailable()) {
  $("memo-row").hidden = true;
  $("memo-hint").textContent = "この 端末には マイクが ないため、ろくおんは つかえません。";
} else {
  $("btn-rec-audio").addEventListener("click", () => void toggleMemoRecording());
}

async function toggleMemoRecording(): Promise<void> {
  const btn = $("btn-rec-audio");
  if (memoRecorder.recording) {
    const result = await memoRecorder.stop();
    btn.classList.remove("is-recording");
    btn.textContent = "● マイクで ろくおん";
    $("memo-status").textContent = "";
    if (!result) {
      toast("ろくおん できませんでした");
      return;
    }
    const meta: MemoMeta = {
      id: newMemoId(),
      name: new Date().toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      videoId: currentVideo?.id ?? null,
      createdAt: Date.now(),
      duration: result.duration,
      mime: result.mime,
    };
    await storeMemo(meta, result.blob);
    memos = [meta, ...memos];
    saveMemos(memos);
    renderMemos();
    toast("ろくおんを ほぞんしました");
    return;
  }

  try {
    await memoRecorder.start();
  } catch {
    // 許可を断られた場合もここに来る。理由を分けても子供には意味がないので 1 文で伝える。
    toast("マイクを つかえませんでした");
    return;
  }
  btn.classList.add("is-recording");
  btn.textContent = "■ ろくおんを おわる";
  $("memo-status").textContent = "ろくおん中…";
}

function renderMemos(): void {
  const list = $("memo-list");
  list.innerHTML = "";
  if (memos.length === 0) return;
  for (const memo of memos) {
    const li = document.createElement("li");
    li.className = "memo-item";

    const play = document.createElement("button");
    play.type = "button";
    play.className = "icon-btn";
    play.textContent = "▶";
    play.addEventListener("click", () => void playMemo(memo, play));

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = memo.name;

    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = formatTime(memo.duration);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "icon-btn";
    del.textContent = "🗑";
    del.setAttribute("aria-label", `${memo.name} を消す`);
    del.addEventListener("click", () => {
      void (async () => {
        if (!confirm("この ろくおんを けしますか？")) return;
        memos = await removeMemo(memos, memo.id);
        saveMemos(memos);
        renderMemos();
      })();
    });

    li.append(play, name, meta, del);
    list.appendChild(li);
  }
}

async function playMemo(memo: MemoMeta, btn: HTMLElement): Promise<void> {
  if (memoAudio) {
    memoAudio.pause();
    memoAudio = null;
    for (const b of document.querySelectorAll(".memo-item .icon-btn")) {
      if (b.textContent === "■") b.textContent = "▶";
    }
    if (btn.textContent === "■") return; // 同じものを押したら停止だけして終わり
  }
  const url = await memoUrl(memo.id);
  if (!url) {
    toast("ろくおんが 見つかりませんでした");
    return;
  }
  const audio = new Audio(url);
  // 速度を落としても音の高さを変えない(遅くしてもキーが変わらないのが要件)。
  audio.preservesPitch = true;
  audio.playbackRate = player.getRate();
  audio.addEventListener("ended", () => {
    btn.textContent = "▶";
    URL.revokeObjectURL(url);
    memoAudio = null;
  });
  await audio.play();
  memoAudio = audio;
  btn.textContent = "■";
}

// ---- メトロノーム ----------------------------------------------------------

function renderMetroLamps(): void {
  const box = $("metro-lamps");
  box.innerHTML = "";
  for (let i = 0; i < metronome.getBeatsPerBar(); i++) {
    const lamp = document.createElement("span");
    lamp.className = "lamp" + (i === 0 ? " is-accent" : "");
    box.appendChild(lamp);
  }
}

metronome.onBeat = (beat) => {
  const lamps = $("metro-lamps").children;
  for (const lamp of lamps) lamp.classList.remove("is-on");
  lamps[beat]?.classList.add("is-on");
};

$("btn-metro").addEventListener("click", () => {
  const running = metronome.toggle();
  const btn = $("btn-metro");
  btn.innerHTML = running ? "■<small>ストップ</small>" : "▶<small>スタート</small>";
  btn.classList.toggle("is-on", running);
  if (!running) for (const lamp of $("metro-lamps").children) lamp.classList.remove("is-on");
});

function setBpm(bpm: number): void {
  metronome.setBpm(bpm);
  $("bpm-label").textContent = String(metronome.getBpm());
  $<HTMLInputElement>("bpm-slider").value = String(metronome.getBpm());
}

$("btn-bpm-down").addEventListener("click", () => setBpm(metronome.getBpm() - 1));
$("btn-bpm-up").addEventListener("click", () => setBpm(metronome.getBpm() + 1));
$<HTMLInputElement>("bpm-slider").addEventListener("input", (e) => setBpm(Number((e.target as HTMLInputElement).value)));

$("btn-tap").addEventListener("click", () => {
  taps.push(performance.now());
  // 打点は増え続けるので、判定に使う範囲だけ残す。
  if (taps.length > 8) taps = taps.slice(-8);
  const bpm = bpmFromTaps(taps);
  if (bpm !== null) setBpm(bpm);
  else $("bpm-label").textContent = "…";
});

for (const btn of document.querySelectorAll<HTMLElement>(".beats")) {
  btn.addEventListener("click", () => {
    metronome.setBeatsPerBar(Number(btn.dataset.beats));
    for (const b of document.querySelectorAll(".beats")) b.classList.remove("is-on");
    btn.classList.add("is-on");
    renderMetroLamps();
  });
}

// ---- 後片付け --------------------------------------------------------------

// 画面を離れるときにマイクを掴んだままにしない(録音中の表示が残り続けるため)。
window.addEventListener("pagehide", () => {
  memoRecorder.cancel();
  synth.allNotesOff();
  metronome.stop();
});

// ---- おとあて（音と音名の対応を覚えるドリル） ---------------------------------
//
// 何をしないかを先に決めてある。弾き方（運指・手の形・姿勢）には触れない。
// 作っているのは資格を持つ人ではないので、そこに踏み込むと妙なクセを付けかねない。
// 一方「この音は ド」「ド はこの鍵」という対応は、誰から習っても同じ事実で、
// 間違った癖の付きようがない。ここで扱うのはそれだけ。
//
// おだいの出しかたは 3 段階。
//   ひかる … 押す鍵が光る。位置を教えるだけで音名は覚えないので、いちばん下の段
//   もじ   … 「ド」と文字で出る。音名 → 鍵 の対応を作る
//   おと   … 音だけ鳴る。音 → 鍵 の対応を作る。ここが目的地
// 課題そのものは同じで、変わるのは「おだいの見せかた」だけ。

type PromptMode = "light" | "letter" | "sound";

const MODE_HINTS: Record<PromptMode, string> = {
  light: "けんばんが 光ります。まず ばしょに なれるための だんかいです。",
  letter: "「ド」のように もじで 出ます。もじと けんばんが むすびつきます。",
  sound: "音だけ 鳴ります。聞いた音が どれか わかるように なります。",
};

/** 一度に作る出題の数。少なすぎると継ぎ目で表示が飛び、多すぎると文字列が長くなる。 */
const DRILL_CHUNK = 12;

/**
 * 出題は鍵盤の左端を「ド」として作る。
 * オクターブを動かしても、答えの鍵が画面の外へ出ないようにするため。
 */
function drillBase(): number {
  return keyboard.getStartMidi();
}

function setPromptMode(mode: PromptMode): void {
  promptMode = mode;
  saveJson("promptMode", mode);
  for (const b of document.querySelectorAll<HTMLElement>(".mode-btn")) {
    b.classList.toggle("is-on", b.dataset.mode === mode);
  }
  $("mode-hint").textContent = MODE_HINTS[mode];
  if (practice) presentStep(true);
}

for (const btn of document.querySelectorAll<HTMLElement>(".mode-btn")) {
  btn.addEventListener("click", () => setPromptMode(btn.dataset.mode as PromptMode));
}

function renderDrills(): void {
  const list = $("drill-list");
  list.innerHTML = "";
  for (const level of DRILL_LEVELS) {
    const best = bestScores[level.id];
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "exercise-item" + (drillLevel?.id === level.id ? " is-on" : "");

    const label = document.createElement("span");
    label.className = "ex-name";
    label.textContent = level.name;
    const sub = document.createElement("small");
    sub.className = "ex-aim";
    sub.textContent = level.aim;
    label.appendChild(sub);

    const mark = document.createElement("span");
    mark.className = "ex-clear";
    // 記録は「できた／できない」ではなく数字で出す。終わりが無い練習なので、
    // 印を付けると「もう終わったもの」に見えてしまう。
    mark.textContent = best ? `${best} 音/分` : "";

    btn.append(label, mark);
    btn.addEventListener("click", () => startDrill(level));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function startDrill(level: DrillLevel): void {
  // 動画のお手本とドリルが同時に鍵盤を光らせると、どちらの光か分からなくなる。
  stopTakePlayback();
  drillLevel = level;
  const steps = makeDrillSteps(level, DRILL_CHUNK, drillBase(), Math.random);
  drillLabels = steps.map(labelOf);
  practice = new GuidedPractice(steps);
  stats = { hits: 0, misses: 0, startedAt: performance.now() };

  $("practice-now").hidden = false;
  $("practice-name").textContent = level.name;
  presentStep(true);
  renderDrills();
}

/** 1 手ぶんの音名。和音は「ドミ」のようにつなげる（流れるドレミと同じ書き方）。 */
function labelOf(step: number[]): string {
  return [...step].sort((a, b) => a - b).map(noteNameJa).join("");
}

function stopDrill(): void {
  if (stats.hits > 0) reportResult();
  practice = null;
  drillLevel = null;
  drillLabels = [];
  keyboard.clearGuide();
  $("practice-now").hidden = true;
  renderDrills();
}

/**
 * 今の手を提示する。
 * @param playSound 音のおだいを鳴らすか。表示だけ作り直すときは false。
 */
function presentStep(playSound: boolean): void {
  const p = practice;
  if (!p) return;
  keyboard.clearGuide();
  $("prompt-strip").hidden = promptMode !== "letter";
  $("prompt-sound").hidden = promptMode !== "sound";

  if (promptMode === "light") {
    for (const midi of p.remaining) keyboard.setGuide(midi, true);
  } else if (promptMode === "letter") {
    renderPromptStrip();
  } else if (playSound) {
    playCurrentPrompt();
  }
  updateStats();
}

/** タイピングソフトのように、今のおだいを強調して先も見せる。 */
function renderPromptStrip(): void {
  const p = practice;
  if (!p) return;
  const now = p.progress.step - 1;
  const strip = $("prompt-strip");
  strip.innerHTML = "";
  // 終わったぶんを全部残すと横に伸び続けるので、直前 2 つと先 8 つだけ出す。
  const from = Math.max(0, now - 2);
  const to = Math.min(drillLabels.length, now + 9);
  for (let i = from; i < to; i++) {
    const el = document.createElement("span");
    el.className = "prompt-item" + (i === now ? " is-now" : i < now ? " is-past" : "");
    el.textContent = drillLabels[i] ?? "";
    strip.appendChild(el);
  }
}

/** 音のおだいを鳴らす。鍵盤を経由しないので、答えの判定には入らない。 */
function playCurrentPrompt(): void {
  const p = practice;
  if (!p) return;
  const notes = p.current;
  for (const midi of notes) synth.noteOn(midi, 0.9);
  window.setTimeout(() => {
    for (const midi of notes) synth.noteOff(midi);
  }, 750);
}

$("btn-replay").addEventListener("click", () => playCurrentPrompt());

// ヒント。分からなくなったとき、今の答えだけ光らせる。
// これが無いと「音のおだい」は詰まったときに行き止まりになる。
$("btn-practice-hint").addEventListener("click", () => {
  const p = practice;
  if (!p) return;
  for (const midi of p.remaining) keyboard.setGuide(midi, true);
  if (promptMode !== "light") {
    window.setTimeout(() => {
      if (practice === p && promptMode !== "light") keyboard.clearGuide();
    }, 1500);
  }
});

function perMinute(): number {
  const minutes = (performance.now() - stats.startedAt) / 60000;
  // 始めた直後は 1 音でも極端な数字になるので、少し経つまで出さない。
  return minutes > 0.08 ? Math.round(stats.hits / minutes) : 0;
}

function updateStats(): void {
  if (!drillLevel) return;
  $("practice-stats").innerHTML =
    `<span>できた <b>${stats.hits}</b></span>` +
    `<span>まちがえ <b>${stats.misses}</b></span>` +
    `<span><b>${perMinute()}</b> 音/分</span>`;
  const best = bestScores[drillLevel.id];
  $("practice-best").textContent = best ? `さいこう ${best} 音/分` : "";
}

function onPracticePress(midi: number): void {
  const p = practice;
  if (!p) return;
  const result = p.press(midi);

  if (result.kind === "wrong") {
    stats.misses++;
    // 責めない。進まないことが、そのまま「ちがう」の合図になる。
    // 音のおだいだけは鳴らしなおす（聞き逃した可能性の方が高いため）。
    if (promptMode === "sound") playCurrentPrompt();
    updateStats();
    return;
  }

  if (result.kind === "partial") {
    // 和音の途中。光らせている場合は、押せた音だけ消す。
    if (promptMode === "light") {
      keyboard.clearGuide();
      for (const m of p.remaining) keyboard.setGuide(m, true);
    }
    return;
  }

  stats.hits++;
  // 残りが減ったところで継ぎ足す。押し切ってから足すと、
  // 一瞬「終わった」状態を通ってしまう。
  if (drillLevel && p.remainingSteps <= 4) {
    const more = makeDrillSteps(drillLevel, DRILL_CHUNK, drillBase(), Math.random);
    p.append(more);
    drillLabels = [...drillLabels, ...more.map(labelOf)];
  }
  presentStep(true);
}

function reportResult(): void {
  const level = drillLevel;
  if (!level) return;
  const score = perMinute();
  const prev = bestScores[level.id] ?? 0;
  // 最高記録は、ある程度の数をこなしたときだけ更新する
  // (数音でやめた記録が残ると、次に届かない目標になってしまう)。
  if (stats.hits >= 20 && score > prev) {
    bestScores[level.id] = score;
    saveJson("best", bestScores);
    toast(`さいこう記録！ ${score} 音/分`);
    return;
  }
  toast(`できた ${stats.hits} 音 ／ まちがえ ${stats.misses}`);
}

$("btn-practice-quit").addEventListener("click", () => stopDrill());
