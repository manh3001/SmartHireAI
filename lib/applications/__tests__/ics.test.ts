import { describe, it, expect } from "vitest";
import { buildIcs } from "../ics";

const base = {
  scheduledAt: new Date("2026-09-10T09:00:00.000Z"),
  summary: "Phỏng vấn: Senior React",
  location: "Hà Nội",
  description: "Vòng kỹ thuật; mang laptop",
  uid: "app_1",
};

describe("buildIcs", () => {
  it("có khung VCALENDAR/VEVENT", () => {
    const s = buildIcs(base);
    expect(s).toContain("BEGIN:VCALENDAR");
    expect(s).toContain("BEGIN:VEVENT");
    expect(s).toContain("END:VEVENT");
    expect(s).toContain("END:VCALENDAR");
    expect(s).toContain("UID:app_1");
  });

  it("DTSTART đúng và DTEND = +1h (UTC)", () => {
    const s = buildIcs(base);
    expect(s).toContain("DTSTART:20260910T090000Z");
    expect(s).toContain("DTEND:20260910T100000Z");
  });

  it("escape ký tự đặc biệt trong TEXT", () => {
    const s = buildIcs({ ...base, location: "A, B; C\nD" });
    expect(s).toContain("LOCATION:A\\, B\\; C\\nD");
  });
});
