import { describe, it, expect } from "vitest";
import { normalizeCv } from "../normalize";
import type { CvInput } from "../types";

const base: CvInput = {
  title: "  CV của tôi  ",
  profile: { fullName: "  Manh  ", headline: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "", summary: "" },
  experiences: [
    { company: "  FPT  ", position: "Dev", startDate: "", endDate: "", description: "" },
    { company: "", position: "", startDate: "", endDate: "", description: "" },
  ],
  educations: [{ school: "", degree: "", major: "", startDate: "", endDate: "", gpa: "" }],
  skills: [{ name: "  React  ", level: "" }, { name: "", level: "" }],
  projects: [{ name: "", description: "", tech: "", link: "" }],
  languages: [],
  certifications: [],
};

describe("normalizeCv", () => {
  it("trim cac chuoi", () => {
    const r = normalizeCv(base);
    expect(r.title).toBe("CV của tôi");
    expect(r.profile.fullName).toBe("Manh");
    expect(r.experiences[0].company).toBe("FPT");
    expect(r.skills[0].name).toBe("React");
  });

  it("loai bo dong rong hoan toan", () => {
    const r = normalizeCv(base);
    expect(r.experiences).toHaveLength(1);
    expect(r.educations).toHaveLength(0);
    expect(r.skills).toHaveLength(1);
    expect(r.projects).toHaveLength(0);
  });
});
