import { describe, it, expect } from "vitest";
import { addVideo, removeVideo, updateVideo, addMark, removeMark, type VideoEntry } from "../src/core/library.ts";

function entry(id: string): VideoEntry {
  return { id, title: id, addedAt: 0, marks: [], loop: null };
}

describe("ライブラリ", () => {
  it("追加した動画は先頭に来る", () => {
    const [list] = addVideo([entry("aaa")], "bbb", "曲B");
    expect(list.map((e) => e.id)).toEqual(["bbb", "aaa"]);
  });

  it("同じ動画は二重に登録しない", () => {
    const base = [entry("aaa")];
    const [list, found, isNew] = addVideo(base, "aaa", "別のタイトル");
    expect(list).toBe(base);
    expect(found.id).toBe("aaa");
    expect(isNew).toBe(false);
  });

  it("削除と部分更新", () => {
    expect(removeVideo([entry("a"), entry("b")], "a").map((e) => e.id)).toEqual(["b"]);
    expect(updateVideo([entry("a")], "a", { title: "新" })[0]!.title).toBe("新");
  });

  it("マーカーは押した順ではなく曲の時刻順に並ぶ", () => {
    let e = entry("a");
    e = addMark(e, { id: "1", time: 30, label: "0:30" });
    e = addMark(e, { id: "2", time: 10, label: "0:10" });
    expect(e.marks.map((m) => m.time)).toEqual([10, 30]);
    expect(removeMark(e, "1").marks.map((m) => m.id)).toEqual(["2"]);
  });
});
