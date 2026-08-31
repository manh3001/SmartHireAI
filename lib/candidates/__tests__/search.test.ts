import { describe, it, expect } from "vitest";
import { applyExpFilter, mapToCandidateCards } from "../search";

type RawRow = {
  id: string;
  shareToken: string | null;
  profile: { fullName: string; headline: string; location: string } | null;
  skills: { name: string }[];
  _count: { experiences: number };
};

function row(experienceCount: number, id = `cv_${experienceCount}`): RawRow {
  return {
    id,
    shareToken: `tok_${id}`,
    profile: { fullName: `Ứng viên ${id}`, headline: "Developer", location: "HCM" },
    skills: [{ name: "React" }, { name: "TypeScript" }],
    _count: { experiences: experienceCount },
  };
}

describe("applyExpFilter", () => {
  it("exp undefined -> trả toàn bộ", () => {
    const rows = [row(0), row(2), row(6)];
    expect(applyExpFilter(rows, undefined)).toHaveLength(3);
  });

  it("exp '0' -> chỉ CV không có kinh nghiệm (0 entries)", () => {
    const rows = [row(0), row(1), row(3)];
    const result = applyExpFilter(rows, "0");
    expect(result).toHaveLength(1);
    expect(result[0]._count.experiences).toBe(0);
  });

  it("exp '1' -> experience entries trong khoảng 1–4", () => {
    const rows = [row(0), row(1), row(4), row(5)];
    const result = applyExpFilter(rows, "1");
    expect(result.map((r) => r._count.experiences)).toEqual([1, 4]);
  });

  it("exp '3' -> experience entries trong khoảng 3–8", () => {
    const rows = [row(2), row(3), row(8), row(9)];
    const result = applyExpFilter(rows, "3");
    expect(result.map((r) => r._count.experiences)).toEqual([3, 8]);
  });

  it("exp '5' -> experience entries >= 5", () => {
    const rows = [row(3), row(5), row(10)];
    const result = applyExpFilter(rows, "5");
    expect(result.map((r) => r._count.experiences)).toEqual([5, 10]);
  });

  it("giá trị exp không hợp lệ -> trả toàn bộ", () => {
    const rows = [row(0), row(5)];
    expect(applyExpFilter(rows, "999")).toHaveLength(2);
  });
});

describe("mapToCandidateCards", () => {
  it("map đúng tất cả các trường", () => {
    const cards = mapToCandidateCards([row(2, "cv_test")]);
    expect(cards[0]).toEqual({
      cvId: "cv_test",
      shareToken: "tok_cv_test",
      fullName: "Ứng viên cv_test",
      headline: "Developer",
      location: "HCM",
      skills: ["React", "TypeScript"],
    });
  });

  it("profile null -> chuỗi rỗng cho fullName, headline, location", () => {
    const r: RawRow = {
      id: "cv_null",
      shareToken: "tok_null",
      profile: null,
      skills: [],
      _count: { experiences: 0 },
    };
    const cards = mapToCandidateCards([r]);
    expect(cards[0].fullName).toBe("");
    expect(cards[0].headline).toBe("");
    expect(cards[0].location).toBe("");
    expect(cards[0].skills).toEqual([]);
  });

  it("skills chỉ lấy name từ mảng object", () => {
    const r = row(0, "cv_sk");
    r.skills = [{ name: "Go" }, { name: "Rust" }];
    const cards = mapToCandidateCards([r]);
    expect(cards[0].skills).toEqual(["Go", "Rust"]);
  });
});
