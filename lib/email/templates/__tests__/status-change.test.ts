import { describe, it, expect } from "vitest";
import {
  statusChangeEmail,
  isEmailTriggerStatus,
} from "../status-change";

describe("isEmailTriggerStatus", () => {
  it("returns true for trigger statuses", () => {
    expect(isEmailTriggerStatus("INTERVIEW")).toBe(true);
    expect(isEmailTriggerStatus("OFFER")).toBe(true);
    expect(isEmailTriggerStatus("HIRED")).toBe(true);
    expect(isEmailTriggerStatus("REJECTED")).toBe(true);
  });

  it("returns false for non-trigger statuses", () => {
    expect(isEmailTriggerStatus("SUBMITTED")).toBe(false);
    expect(isEmailTriggerStatus("SCREENING")).toBe(false);
    expect(isEmailTriggerStatus("WITHDRAWN")).toBe(false);
  });
});

describe("statusChangeEmail", () => {
  const base = {
    candidateName: "Nguyễn Văn A",
    jobTitle: "Frontend Developer",
    companyName: "TechCorp",
  };

  it("INTERVIEW — correct subject and headline in html", () => {
    const { subject, html } = statusChangeEmail({ ...base, status: "INTERVIEW" });
    expect(subject).toBe("Bạn đã được mời phỏng vấn");
    expect(html).toContain("Chúc mừng!");
    expect(html).toContain("Frontend Developer");
    expect(html).toContain("TechCorp");
  });

  it("OFFER — subject contains offer", () => {
    const { subject } = statusChangeEmail({ ...base, status: "OFFER" });
    expect(subject).toBe("Bạn đã nhận được offer");
  });

  it("HIRED — subject indicates acceptance", () => {
    const { subject } = statusChangeEmail({ ...base, status: "HIRED" });
    expect(subject).toBe("Đơn ứng tuyển được chấp nhận");
  });

  it("REJECTED — html contains thank-you message", () => {
    const { subject, html } = statusChangeEmail({ ...base, status: "REJECTED" });
    expect(subject).toBe("Thông báo về đơn ứng tuyển");
    expect(html).toContain("Cảm ơn");
  });

  it("html includes candidate name", () => {
    const { html } = statusChangeEmail({ ...base, status: "INTERVIEW" });
    expect(html).toContain("Nguyễn Văn A");
  });
});
