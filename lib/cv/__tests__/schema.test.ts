import { describe, it, expect } from "vitest";
import { cvSchema, emptyCv } from "../schema";

describe("cvSchema", () => {
  it("chap nhan CV hop le", () => {
    const r = cvSchema.safeParse({
      title: "CV",
      profile: { fullName: "Manh", headline: "", email: "", phone: "", summary: "" },
      experiences: [{ company: "FPT", position: "Dev", startDate: "", endDate: "", description: "" }],
      educations: [],
      skills: [{ name: "React", level: "" }],
      projects: [],
    });
    expect(r.success).toBe(true);
  });

  it("tu choi khi thieu fullName", () => {
    const r = cvSchema.safeParse({
      title: "CV",
      profile: { fullName: "", headline: "", email: "", phone: "", summary: "" },
      experiences: [],
      educations: [],
      skills: [],
      projects: [],
    });
    expect(r.success).toBe(false);
  });

  it("tu choi experience thieu company", () => {
    const r = cvSchema.safeParse({
      title: "CV",
      profile: { fullName: "Manh", headline: "", email: "", phone: "", summary: "" },
      experiences: [{ company: "", position: "Dev", startDate: "", endDate: "", description: "" }],
      educations: [],
      skills: [],
      projects: [],
    });
    expect(r.success).toBe(false);
  });

  it("emptyCv tra ve CV rong hop le ve cau truc", () => {
    const e = emptyCv();
    expect(e.profile.fullName).toBe("");
    expect(e.experiences).toEqual([]);
    expect(e.skills).toEqual([]);
  });
});
