import { describe, it, expect, vi } from "vitest";
import { getUpcomingInterviews, type UpcomingRow, type UpcomingDeps } from "../upcoming";

const row = (id: string, at: string): UpcomingRow => ({
  applicationId: id, jobId: "j", jobTitle: "T", company: "C",
  counterpartName: "N", scheduledAt: new Date(at), location: "", meetingLink: "",
});

function deps(over: Partial<UpcomingDeps> = {}): UpcomingDeps {
  return {
    listForCandidate: vi.fn().mockResolvedValue([]),
    listForRecruiter: vi.fn().mockResolvedValue([]),
    ...over,
  };
}

describe("getUpcomingInterviews", () => {
  it("CANDIDATE dùng listForCandidate", async () => {
    const d = deps({ listForCandidate: vi.fn().mockResolvedValue([row("a", "2026-09-10T09:00:00Z")]) });
    const r = await getUpcomingInterviews("u1", "CANDIDATE", new Date("2026-09-01"), d);
    expect(r.map((x) => x.applicationId)).toEqual(["a"]);
    expect(d.listForRecruiter).not.toHaveBeenCalled();
  });

  it("RECRUITER dùng listForRecruiter", async () => {
    const d = deps({ listForRecruiter: vi.fn().mockResolvedValue([row("b", "2026-09-10T09:00:00Z")]) });
    const r = await getUpcomingInterviews("u1", "RECRUITER", new Date("2026-09-01"), d);
    expect(r.map((x) => x.applicationId)).toEqual(["b"]);
    expect(d.listForCandidate).not.toHaveBeenCalled();
  });

  it("sắp xếp tăng dần theo scheduledAt", async () => {
    const d = deps({
      listForCandidate: vi.fn().mockResolvedValue([
        row("late", "2026-09-20T09:00:00Z"),
        row("early", "2026-09-11T09:00:00Z"),
      ]),
    });
    const r = await getUpcomingInterviews("u1", "CANDIDATE", new Date("2026-09-01"), d);
    expect(r.map((x) => x.applicationId)).toEqual(["early", "late"]);
  });
});
