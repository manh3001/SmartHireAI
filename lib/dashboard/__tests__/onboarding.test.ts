import { describe, it, expect } from "vitest";
import { computeOnboarding, type OnboardingSignals } from "../onboarding";

const NONE: OnboardingSignals = {
  hasCV: false, hasBio: false, hasApplication: false, hasCompany: false, hasJob: false,
};

describe("computeOnboarding", () => {
  it("CANDIDATE: 3 bước, done khớp signals", () => {
    const r = computeOnboarding("CANDIDATE", { ...NONE, hasCV: true, hasBio: true });
    expect(r.total).toBe(3);
    expect(r.steps.map((s) => s.key)).toEqual(["cv", "bio", "apply"]);
    expect(r.steps.map((s) => s.done)).toEqual([true, true, false]);
    expect(r.completed).toBe(2);
    expect(r.allDone).toBe(false);
  });

  it("CANDIDATE: đủ 3 -> allDone", () => {
    const r = computeOnboarding("CANDIDATE", { ...NONE, hasCV: true, hasBio: true, hasApplication: true });
    expect(r.completed).toBe(3);
    expect(r.allDone).toBe(true);
  });

  it("RECRUITER: 2 bước, không lẫn bước candidate", () => {
    const r = computeOnboarding("RECRUITER", { ...NONE, hasCompany: true });
    expect(r.total).toBe(2);
    expect(r.steps.map((s) => s.key)).toEqual(["company", "job"]);
    expect(r.completed).toBe(1);
    expect(r.allDone).toBe(false);
  });

  it("RECRUITER: đủ 2 -> allDone", () => {
    const r = computeOnboarding("RECRUITER", { ...NONE, hasCompany: true, hasJob: true });
    expect(r.allDone).toBe(true);
  });

  it("mỗi bước có href + label", () => {
    const r = computeOnboarding("CANDIDATE", NONE);
    expect(r.steps[0]).toMatchObject({ key: "cv", label: "Tạo CV", href: "/dashboard" });
  });
});
