import { describe, it, expect } from "vitest";
import { tallySkills } from "../top-skills";

describe("tallySkills", () => {
  it("chuoi rong/khoang trang -> []", () => {
    expect(tallySkills([{ skills: "" }, { skills: "   " }])).toEqual([]);
  });

  it("dem tan suat, sap xep giam dan", () => {
    const rows = [
      { skills: "React, Node" },
      { skills: "react, TypeScript" },
      { skills: "React" },
    ];
    // React xuat hien 3 (khong phan biet hoa thuong) -> dau tien
    expect(tallySkills(rows)[0]).toBe("React");
  });

  it("gop trung khong phan biet hoa thuong, giu dang hien thi lan dau", () => {
    const rows = [{ skills: "react" }, { skills: "REACT" }];
    expect(tallySkills(rows)).toEqual(["react"]);
  });

  it("dedupe trong cung mot tin", () => {
    const rows = [{ skills: "React, React, Node" }];
    const out = tallySkills(rows);
    expect(out.filter((s) => s.toLowerCase() === "react")).toHaveLength(1);
  });

  it("gioi han limit", () => {
    const rows = [{ skills: "a, b, c, d, e" }];
    expect(tallySkills(rows, 3)).toHaveLength(3);
  });

  it("tie-break theo alphabet khi cung tan suat", () => {
    const rows = [{ skills: "Zebra, Apple" }];
    expect(tallySkills(rows)).toEqual(["Apple", "Zebra"]);
  });
});
