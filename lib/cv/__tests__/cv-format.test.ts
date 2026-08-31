import { describe, it, expect } from "vitest";
import { dateRange, contactLine, linksLine, eduSubLine } from "../cv-format";

describe("cv-format", () => {
  it("dateRange: đủ hai -> 'a - b'", () => {
    expect(dateRange("2023-01", "2024-06")).toBe("2023-01 - 2024-06");
  });
  it("dateRange: một rỗng -> phần còn lại", () => {
    expect(dateRange("2023", "")).toBe("2023");
    expect(dateRange("", "2024")).toBe("2024");
  });
  it("dateRange: cả hai rỗng -> ''", () => {
    expect(dateRange("", "")).toBe("");
  });
  it("contactLine: ghép bằng '  •  '", () => {
    expect(contactLine("a@b.com", "0900")).toBe("a@b.com  •  0900");
  });
  it("contactLine: một rỗng -> phần còn lại; cả hai rỗng -> ''", () => {
    expect(contactLine("a@b.com", "")).toBe("a@b.com");
    expect(contactLine("", "")).toBe("");
  });
  it("contactLine: có location thì thêm vào cuối", () => {
    expect(contactLine("a@b.com", "0900", "Hà Nội")).toBe("a@b.com  •  0900  •  Hà Nội");
  });
  it("linksLine: ghép các link bằng '  •  '", () => {
    expect(linksLine("linkedin.com/in/x", "github.com/x", "")).toBe("linkedin.com/in/x  •  github.com/x");
    expect(linksLine("", "", "")).toBe("");
  });
  it("eduSubLine: degree + major ghép bằng ' – ', thêm range và GPA bằng '  •  '", () => {
    expect(eduSubLine("Cử nhân", "CNTT", "2019 - 2023")).toBe("Cử nhân – CNTT  •  2019 - 2023");
    expect(eduSubLine("", "CNTT", "2019 - 2023")).toBe("CNTT  •  2019 - 2023");
    expect(eduSubLine("Cử nhân", "CNTT", "2019 - 2023", "3.6/4.0")).toBe("Cử nhân – CNTT  •  2019 - 2023  •  GPA: 3.6/4.0");
    expect(eduSubLine("", "", "2019")).toBe("2019");
  });
});
