import { describe, it, expect, vi } from "vitest";
import { runAddNote, type AddNoteDeps } from "../notes-logic";

function deps(over: Partial<AddNoteDeps> = {}): AddNoteDeps {
  return {
    findApplicationForRecruiter: vi.fn().mockResolvedValue({ id: "app_1" }),
    createNote: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe("runAddNote", () => {
  it("happy path: tạo note thành công", async () => {
    const d = deps();
    const r = await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "Ghi chú tốt" },
      d,
    );
    expect(r).toEqual({ ok: true });
    expect(d.createNote).toHaveBeenCalledWith({
      applicationId: "app_1",
      recruiterId: "r_1",
      content: "Ghi chú tốt",
    });
  });

  it("từ chối nếu NTD không phải chủ job", async () => {
    const r = await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "Ghi chú" },
      deps({ findApplicationForRecruiter: vi.fn().mockResolvedValue(null) }),
    );
    expect(r).toEqual({ ok: false, error: "Không có quyền thêm ghi chú" });
  });

  it("từ chối nếu content rỗng hoặc toàn khoảng trắng", async () => {
    const r = await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "   " },
      deps(),
    );
    expect(r).toEqual({ ok: false, error: "Ghi chú không được để trống" });
  });

  it("từ chối nếu content quá 2000 ký tự", async () => {
    const r = await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "a".repeat(2001) },
      deps(),
    );
    expect(r).toEqual({ ok: false, error: "Ghi chú không được vượt quá 2000 ký tự" });
  });

  it("trim whitespace trước khi lưu", async () => {
    const d = deps();
    await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "  Ghi chú  " },
      d,
    );
    expect(d.createNote).toHaveBeenCalledWith(
      expect.objectContaining({ content: "Ghi chú" }),
    );
  });

  it("không gọi createNote nếu validation fail", async () => {
    const d = deps();
    await runAddNote(
      { applicationId: "app_1", recruiterId: "r_1", content: "" },
      d,
    );
    expect(d.createNote).not.toHaveBeenCalled();
  });
});
