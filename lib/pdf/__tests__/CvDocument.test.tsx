// @vitest-environment node
import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { CvDocument } from "../CvDocument";
import type { CvInput } from "@/lib/cv/types";

const sample: CvInput = {
  title: "CV của Nguyễn Đức Mạnh",
  profile: {
    fullName: "Nguyễn Đức Mạnh",
    headline: "Kỹ sư phần mềm",
    email: "manh@example.com",
    phone: "0900000000",
    location: "Hà Nội",
    linkedin: "",
    github: "",
    portfolio: "",
    summary: "Lập trình viên yêu thích xây dựng sản phẩm.",
  },
  experiences: [
    { company: "FPT Software", position: "Lập trình viên", startDate: "2023-01", endDate: "2024-06", description: "Phát triển ứng dụng web." },
  ],
  educations: [
    { school: "Đại học Bách Khoa", degree: "Kỹ sư", major: "Công nghệ thông tin", startDate: "2019", endDate: "2023", gpa: "3.2" },
  ],
  skills: [{ name: "React", level: "Nâng cao" }],
  projects: [
    { name: "Nền tảng CV", description: "Đánh giá CV bằng AI", tech: "Next.js", link: "https://example.com" },
  ],
  languages: [],
  certifications: [],
};

describe("CvDocument", () => {
  it("render ra PDF hop le tu du lieu tieng Viet", async () => {
    const buffer = await renderToBuffer(<CvDocument cv={sample} />);
    // Header PDF hop le
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // PDF co noi dung dang ke (khong rong)
    expect(buffer.length).toBeGreaterThan(2000);
  });

  it.each(["classic", "modern", "sidebar"] as const)(
    "render mẫu %s ra PDF hợp lệ",
    async (tpl) => {
      const buffer = await renderToBuffer(<CvDocument cv={sample} template={tpl} />);
      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(buffer.length).toBeGreaterThan(2000);
    },
  );

  it.each([
    { template: "modern", accent: "rose", font: "lora" },
    { template: "sidebar", accent: "emerald", font: "bevietnam" },
    { template: "classic", accent: "amber", font: "bevietnam" },
  ] as const)(
    "render với accent+font (%o) ra PDF hợp lệ",
    async ({ template, accent, font }) => {
      const buffer = await renderToBuffer(<CvDocument cv={sample} template={template} accent={accent} font={font} />);
      expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(buffer.length).toBeGreaterThan(2000);
    },
  );
});
