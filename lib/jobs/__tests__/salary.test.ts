import { describe, it, expect } from "vitest";
import {
  formatSalary,
  parseSalaryInput,
  salaryWhere,
  SALARY_FILTER_STEPS,
} from "../salary";

describe("formatSalary", () => {
  it("đủ khoảng min–max", () => {
    expect(formatSalary(15_000_000, 25_000_000, false)).toBe("15 – 25 triệu");
  });
  it("chỉ sàn", () => {
    expect(formatSalary(15_000_000, null, false)).toBe("Từ 15 triệu");
  });
  it("chỉ trần", () => {
    expect(formatSalary(null, 25_000_000, false)).toBe("Tới 25 triệu");
  });
  it("không số + thỏa thuận -> Thỏa thuận", () => {
    expect(formatSalary(null, null, true)).toBe("Thỏa thuận");
  });
  it("không số + không thỏa thuận -> null", () => {
    expect(formatSalary(null, null, false)).toBeNull();
  });
  it("số lẻ triệu hiển thị 1 chữ số thập phân", () => {
    expect(formatSalary(12_500_000, null, false)).toBe("Từ 12.5 triệu");
  });
  it("có số thì bỏ qua cờ thỏa thuận", () => {
    expect(formatSalary(20_000_000, 30_000_000, true)).toBe("20 – 30 triệu");
  });
});

describe("parseSalaryInput", () => {
  it("số triệu -> VND", () => {
    expect(parseSalaryInput("20")).toBe(20_000_000);
  });
  it("chấp nhận dấu phẩy thập phân", () => {
    expect(parseSalaryInput("12,5")).toBe(12_500_000);
  });
  it("rỗng -> null", () => {
    expect(parseSalaryInput("")).toBeNull();
    expect(parseSalaryInput("   ")).toBeNull();
  });
  it("rác -> null", () => {
    expect(parseSalaryInput("abc")).toBeNull();
  });
  it("số âm -> null", () => {
    expect(parseSalaryInput("-5")).toBeNull();
  });
});

describe("salaryWhere", () => {
  it("null -> rỗng", () => {
    expect(salaryWhere(null)).toEqual({});
  });
  it("dựng OR theo salaryMax, fallback salaryMin", () => {
    expect(salaryWhere(15)).toEqual({
      OR: [
        { salaryMax: { gte: 15_000_000 } },
        { AND: [{ salaryMax: null }, { salaryMin: { gte: 15_000_000 } }] },
      ],
    });
  });
});

describe("SALARY_FILTER_STEPS", () => {
  it("có các mốc tăng dần", () => {
    expect(SALARY_FILTER_STEPS).toEqual([10, 15, 20, 25, 30, 40, 50]);
  });
});
