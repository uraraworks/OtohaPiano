import { describe, it, expect } from "vitest";
import { parseVideoId, parseStartSeconds, parseTimeToken, formatTime } from "../src/core/youtubeUrl.ts";

// 企画書が「全形式対応のパーサー必須(v0 品質ポイント)」と名指ししている箇所。
// 親は YouTube アプリの共有からそのまま貼るので、変な形が普通に来る。
describe("parseVideoId", () => {
  const ID = "z9JZB08qy44"; // テスト曲(花になって)の動画 ID

  it("watch?v= 形式", () => {
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("youtu.be 短縮形 + ?si= 付き(アプリの共有で来る形)", () => {
    expect(parseVideoId(`https://youtu.be/${ID}?si=AbCdEfGhIjKlMnOp`)).toBe(ID);
  });

  it("t= の位置指定が付いていても ID だけ取る", () => {
    expect(parseVideoId(`https://www.youtube.com/watch?v=${ID}&t=42s`)).toBe(ID);
  });

  it("m. / music. / スキーム無し", () => {
    expect(parseVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseVideoId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(parseVideoId(`youtu.be/${ID}`)).toBe(ID);
  });

  it("embed / shorts / live", () => {
    expect(parseVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseVideoId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
  });

  it("共有テキストに混じった URL", () => {
    expect(parseVideoId(`これ練習してる https://youtu.be/${ID}?si=xx かわいい`)).toBe(ID);
  });

  it("前後の空白と改行", () => {
    expect(parseVideoId(`  https://www.youtube.com/watch?v=${ID}\n`)).toBe(ID);
  });

  it("ID をそのまま貼った場合", () => {
    expect(parseVideoId(ID)).toBe(ID);
  });

  it("YouTube 以外・壊れた入力は null", () => {
    expect(parseVideoId("https://example.com/watch?v=z9JZB08qy44")).toBeNull();
    expect(parseVideoId("https://www.youtube.com/")).toBeNull();
    expect(parseVideoId("")).toBeNull();
    expect(parseVideoId("ただの文章")).toBeNull();
    // 11 文字でない ID は受け付けない(切れた URL を登録して壊れるのを防ぐ)。
    expect(parseVideoId("https://youtu.be/short")).toBeNull();
  });
});

describe("parseStartSeconds", () => {
  it("t=90s / t=1m30s / start=", () => {
    expect(parseStartSeconds("https://youtu.be/z9JZB08qy44?t=90s")).toBe(90);
    expect(parseStartSeconds("https://www.youtube.com/watch?v=z9JZB08qy44&t=1m30s")).toBe(90);
    expect(parseStartSeconds("https://www.youtube.com/watch?v=z9JZB08qy44&start=12")).toBe(12);
  });

  it("位置指定が無ければ null", () => {
    expect(parseStartSeconds("https://youtu.be/z9JZB08qy44")).toBeNull();
  });
});

describe("parseTimeToken", () => {
  it("各表記", () => {
    expect(parseTimeToken("90")).toBe(90);
    expect(parseTimeToken("90s")).toBe(90);
    expect(parseTimeToken("1m30s")).toBe(90);
    expect(parseTimeToken("1h2m3s")).toBe(3723);
    expect(parseTimeToken("abc")).toBeNull();
    expect(parseTimeToken("")).toBeNull();
  });
});

describe("formatTime", () => {
  it("分:秒 と 時:分:秒", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(75)).toBe("1:15");
    expect(formatTime(3723)).toBe("1:02:03");
    // 再生開始直後は NaN が来ることがある。0 に倒して表示を壊さない。
    expect(formatTime(Number.NaN)).toBe("0:00");
  });
});
