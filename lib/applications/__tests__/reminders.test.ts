import { describe, it, expect } from "vitest";
import { selectDueReminders, type DueInterview } from "../reminders";

const now = new Date("2026-09-10T08:00:00Z");
const iv = (id: string, at: string): DueInterview => ({
  applicationId: id, candidateId: "c", recruiterId: "r", jobTitle: "T", scheduledAt: new Date(at),
});

describe("selectDueReminders", () => {
  it("chọn lịch trong vòng 24h tới", () => {
    const r = selectDueReminders([iv("soon", "2026-09-10T20:00:00Z")], now);
    expect(r.map((x) => x.applicationId)).toEqual(["soon"]);
  });

  it("bỏ lịch quá 24h", () => {
    const r = selectDueReminders([iv("far", "2026-09-12T09:00:00Z")], now);
    expect(r).toEqual([]);
  });

  it("bỏ lịch đã qua (trước now)", () => {
    const r = selectDueReminders([iv("past", "2026-09-10T07:00:00Z")], now);
    expect(r).toEqual([]);
  });

  it("biên đúng: đúng now và đúng now+24h đều được chọn", () => {
    const r = selectDueReminders(
      [iv("atNow", "2026-09-10T08:00:00Z"), iv("at24h", "2026-09-11T08:00:00Z")],
      now,
    );
    expect(r.map((x) => x.applicationId).sort()).toEqual(["at24h", "atNow"]);
  });
});
