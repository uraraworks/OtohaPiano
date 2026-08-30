// 弦の音を計算で作る（撥弦モデル / Karplus-Strong 系）。
//
// なぜ倍音を足す方式をやめたか:
//   正弦波を並べる方式（加算合成）では、倍音の数と減衰までは真似できるが、
//   グランドピアノらしさの正体である
//     ・1 音に弦が 2〜3 本あり、互いにわずかにずれて唸る
//     ・打鍵直後の、倍音では書けない複雑な過渡音
//     ・鳴っている間に倍音の構成が刻々と変わること
//   が作れない。結果として「電子ピアノ」に聞こえる。
//
//   ここでは弦の振動そのものを数値計算する。遅延線を一周させながら少しずつ
//   高い成分を失わせるだけで、上の倍音が先に消える・打鍵音が混ざる・
//   減衰しながら音色が丸くなる、が自然に出る（作り込むのではなく、
//   物理の側から出てくる）。外部ファイルは要らないので、
//   「完全静的・権利問題なし」の柱も崩さない。
//
// 計算した波形は音の高さごとに使い回す。1 音ぶんの生成は数ミリ秒で、
// 一度作れば以降は再生するだけになる。

export interface StringOptions {
  /** 基音の周波数(Hz)。 */
  freq: number;
  /** 標本化周波数。AudioContext のものを渡す。 */
  sampleRate: number;
  /** 音が -60dB まで落ちるまでの時間(秒)。低い音ほど長い。 */
  decaySeconds: number;
  /**
   * 弦を一周するたびに高い成分をどれだけ失うか(0〜1)。
   * 大きいほど早く丸くなる＝柔らかい音。
   */
  damping: number;
  /**
   * 同じ音に張られた弦の数。ピアノは中音以上で 3 本あり、
   * わずかにずれて張られている。この「ずれ」が唸りになり、
   * 単音でも厚みのある響きになる（1 本だけだと痩せて電子的に聞こえる）。
   */
  strings: number;
  /** 弦どうしのずれ(セント)。 */
  detuneCents: number;
  /** 打鍵の硬さ(0〜1)。大きいほど高い成分を含む＝硬い音。 */
  brightness: number;
  /** 0 以上 1 未満を返す関数。テストから固定できるよう引数で受け取る。 */
  rng: () => number;
}

/** 1 本の弦を鳴らして波形を返す。 */
function renderOneString(
  out: Float32Array,
  freq: number,
  sampleRate: number,
  decaySeconds: number,
  damping: number,
  brightness: number,
  gain: number,
  rng: () => number,
): void {
  // 遅延線の長さ = 1 周期ぶんの標本数。小数部は読み出しの補間で埋める
  // (整数に丸めると、高い音ほど音程がずれる。4 セント狂うと耳に付く)。
  const period = sampleRate / freq;
  const len = Math.ceil(period) + 2;
  const line = new Float32Array(len);

  // 打鍵の励起。白色雑音そのままだと硬すぎるので、
  // 平滑化して高い成分を落とす。brightness が硬さの調整。
  const smooth = 1 - brightness;
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const noise = rng() * 2 - 1;
    prev = noise * (1 - smooth) + prev * smooth;
    line[i] = prev;
  }
  // 端を丸めて、繰り返しの継ぎ目が「プツッ」と鳴らないようにする。
  for (let i = 0; i < len; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (len - 1));
    line[i] = line[i]! * w;
  }

  // 1 周ごとの損失。decaySeconds で -60dB まで落ちるように決める。
  const loops = (decaySeconds * sampleRate) / period;
  const rho = Math.pow(0.001, 1 / Math.max(1, loops));

  let write = 0;
  let lpPrev = 0;
  for (let n = 0; n < out.length; n++) {
    // 1 周期前を小数位置で読む。
    let read = write - period;
    if (read < 0) read += len;
    const i0 = Math.floor(read);
    const frac = read - i0;
    const i1 = (i0 + 1) % len;
    const s = line[i0]! * (1 - frac) + line[i1]! * frac;

    // 一周するたびに高い成分を落とす。上の倍音が先に消えるのはここから出る。
    lpPrev = s * (1 - damping) + lpPrev * damping;
    const y = lpPrev * rho;

    line[write] = y;
    out[n] = out[n]! + y * gain;
    write = (write + 1) % len;
  }
}

/**
 * 弦の波形を作る。複数本ぶんを重ねて 1 本の波形にする。
 * @returns [-1, 1] にほぼ収まる波形。長さは decaySeconds ぶん。
 */
export function renderString(opts: StringOptions): Float32Array {
  const { freq, sampleRate, decaySeconds, damping, strings, detuneCents, brightness, rng } = opts;
  const length = Math.max(1, Math.floor(decaySeconds * sampleRate));
  const out = new Float32Array(length);

  for (let i = 0; i < strings; i++) {
    // 中央の弦を基準に、上下へ均等にずらす。
    const offset = strings === 1 ? 0 : (i / (strings - 1) - 0.5) * 2;
    const cents = offset * detuneCents;
    const f = freq * Math.pow(2, cents / 1200);
    // ずれた弦は減衰も少しだけ変える。まったく同じだと唸りが機械的になる。
    const dec = decaySeconds * (1 + offset * 0.06);
    renderOneString(out, f, sampleRate, dec, damping, brightness, 1 / strings, rng);
  }

  // 山を 1 に揃える。弦の本数や音の高さで音量が変わらないようにするため。
  let peak = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(out[i]!));
  if (peak > 0) {
    const k = 0.9 / peak;
    for (let i = 0; i < length; i++) out[i] = out[i]! * k;
  }
  return out;
}

/**
 * ピアノらしい設定を音の高さから決める。
 * 低い音は長く伸びて柔らかく、高い音は短くて硬い。
 * 一律にすると、どの音も同じ長さで鳴って作り物に聞こえる。
 */
export function pianoStringOptions(midi: number, sampleRate: number, rng: () => number): StringOptions {
  // 減衰時間。低音は長く、高音は短く。実際のピアノの傾向に合わせる。
  // 上限は 5 秒。本物の低音はもっと伸びるが、波形を持ち回るので長さがそのまま
  // メモリになる(1 秒あたり約 190KB)。子供が弾く用途では 5 秒で足りる。
  const decaySeconds = Math.min(5, Math.max(0.7, 9 * Math.pow(2, -(midi - 36) / 26)));
  // 高い音ほど弦が短く、失われる成分も少ない＝減衰の色が変わる。
  const damping = Math.min(0.6, Math.max(0.08, 0.5 - (midi - 36) / 200));
  // 低音は 1〜2 本、中音以上は 3 本張られている。
  const strings = midi < 40 ? 1 : midi < 52 ? 2 : 3;
  return {
    freq: 440 * Math.pow(2, (midi - 69) / 12),
    sampleRate,
    decaySeconds,
    damping,
    strings,
    // ずれが大きすぎると調律が狂って聞こえ、小さすぎると唸らない。
    detuneCents: 1.2,
    brightness: Math.min(0.9, 0.45 + (midi - 36) / 120),
    rng,
  };
}
