import { describe, it, expect } from "vitest";
import { salaryNoteSchema } from "../salary-note-schema";

describe("salaryNoteSchema", () => {
  it("parse { note }", () => {
    expect(salaryNoteSchema.parse({ note: "Khoảng này hợp lý." }).note).toBe("Khoảng này hợp lý.");
  });
  it("thiếu note -> throw", () => {
    expect(() => salaryNoteSchema.parse({})).toThrow();
  });
});
