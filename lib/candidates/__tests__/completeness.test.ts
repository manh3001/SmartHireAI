import { describe, it, expect } from "vitest";
import { profileCompleteness } from "../completeness";

const empty = { hasCV: false, bio: "", github: "", linkedin: "", website: "" };
const full = { hasCV: true, bio: "Xin chào", github: "g", linkedin: "l", website: "w" };

describe("profileCompleteness", () => {
  it("rỗng hết -> 0%, thiếu 5 mục", () => {
    const r = profileCompleteness(empty);
    expect(r.percent).toBe(0);
    expect(r.missing).toHaveLength(5);
    expect(r.missing[0].key).toBe("hasCV");
  });

  it("đủ 5 -> 100%, không thiếu", () => {
    const r = profileCompleteness(full);
    expect(r.percent).toBe(100);
    expect(r.missing).toEqual([]);
  });

  it("có CV + bio -> 40%, thiếu theo thứ tự github/linkedin/website", () => {
    const r = profileCompleteness({ ...empty, hasCV: true, bio: "hi" });
    expect(r.percent).toBe(40);
    expect(r.missing.map((m) => m.key)).toEqual(["github", "linkedin", "website"]);
  });

  it("bio chỉ khoảng trắng coi như trống", () => {
    const r = profileCompleteness({ ...full, bio: "   " });
    expect(r.missing.map((m) => m.key)).toEqual(["bio"]);
  });
});
