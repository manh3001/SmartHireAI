import { describe, it, expect } from "vitest";
import { buildJobAlertEmail } from "../job-alert-email";

const base = {
  id: "job123",
  title: "Lập trình viên React",
  company: "FPT Software",
  location: "Hà Nội" as string | null,
  salaryMin: 20_000_000 as number | null,
  salaryMax: 30_000_000 as number | null,
};

describe("buildJobAlertEmail", () => {
  it("subject chứa tiêu đề (text thuần)", () => {
    const { subject } = buildJobAlertEmail(base, "https://smarthire.vn");
    expect(subject).toBe("Việc làm mới khớp thông báo: Lập trình viên React");
  });
  it("html chứa công ty và link tuyệt đối", () => {
    const { html } = buildJobAlertEmail(base, "https://smarthire.vn");
    expect(html).toContain("FPT Software");
    expect(html).toContain('href="https://smarthire.vn/jobs/job123"');
  });
  it("có dòng lương khi truyền salary, không có khi null", () => {
    expect(buildJobAlertEmail(base, "https://x").html).toContain("Mức lương");
    const noSalary = { ...base, salaryMin: null, salaryMax: null };
    expect(buildJobAlertEmail(noSalary, "https://x").html).not.toContain("Mức lương");
  });
  it("có địa điểm khi truyền, không có khi null", () => {
    expect(buildJobAlertEmail(base, "https://x").html).toContain("Hà Nội");
    const noLoc = { ...base, location: null };
    expect(buildJobAlertEmail(noLoc, "https://x").html).not.toContain("Địa điểm");
  });
  it("escape ký tự HTML trong tiêu đề/công ty", () => {
    const evil = { ...base, title: "Dev <script>", company: "A & B" };
    const { html } = buildJobAlertEmail(evil, "https://x");
    expect(html).toContain("Dev &lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });
});
