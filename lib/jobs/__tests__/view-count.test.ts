import { describe, it, expect } from "vitest";
import { recordView } from "../view-count";

const TODAY = "2026-09-13";

describe("recordView", () => {
  it("cookie rỗng -> đếm, cookie mới today|jobId", () => {
    expect(recordView(undefined, "j1", TODAY)).toEqual({ count: true, cookie: "2026-09-13|j1" });
  });

  it("cùng ngày, cùng tin -> không đếm, giữ cookie", () => {
    const r = recordView("2026-09-13|j1", "j1", TODAY);
    expect(r).toEqual({ count: false, cookie: "2026-09-13|j1" });
  });

  it("cùng ngày, tin mới -> đếm, thêm id", () => {
    const r = recordView("2026-09-13|j1", "j2", TODAY);
    expect(r).toEqual({ count: true, cookie: "2026-09-13|j1,j2" });
  });

  it("ngày khác -> reset (đếm, cookie chỉ tin hiện tại)", () => {
    const r = recordView("2026-09-12|j1,j2", "j3", TODAY);
    expect(r).toEqual({ count: true, cookie: "2026-09-13|j3" });
  });

  it("cookie hỏng (không có '|') -> coi như mới, đếm", () => {
    const r = recordView("garbage", "j1", TODAY);
    expect(r).toEqual({ count: true, cookie: "2026-09-13|j1" });
  });
});
