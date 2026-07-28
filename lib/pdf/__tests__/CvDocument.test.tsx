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
    summary: "Lập trình viên yêu thích xây dựng sản phẩm.",
  },
  experiences: [
    { company: "FPT Software", position: "Lập trình viên", startDate: "2023-01", endDate: "2024-06", description: "Phát triển ứng dụng web." },
  ],
  educations: [
    { school: "Đại học Bách Khoa", major: "Công nghệ thông tin", startDate: "2019", endDate: "2023" },
  ],
  skills: [{ name: "React", level: "Nâng cao" }],
  projects: [
    { name: "Nền tảng CV", description: "Đánh giá CV bằng AI", tech: "Next.js", link: "https://example.com" },
  ],
};

describe("CvDocument", () => {
  it("render ra PDF hop le tu du lieu tieng Viet", async () => {
    const buffer = await renderToBuffer(<CvDocument cv={sample} />);
    // Header PDF hop le
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // PDF co noi dung dang ke (khong rong)
    expect(buffer.length).toBeGreaterThan(2000);
  });
});
