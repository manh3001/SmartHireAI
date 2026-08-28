import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, nextCursorFrom } from "../cursor";

describe("cursor encode/decode", () => {
  it("round-trip keyset", () => {
    const c = { mode: "keyset", createdAt: "2026-01-01T00:00:00.000Z", id: "abc" } as const;
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it("round-trip offset", () => {
    const c = { mode: "offset", offset: 40 } as const;
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
  it("input hong/thieu -> null", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("!!!not-base64-json")).toBeNull();
    expect(decodeCursor(Buffer.from('{"mode":"x"}').toString("base64"))).toBeNull();
  });
});

describe("nextCursorFrom", () => {
  const rows = Array.from({ length: 21 }, (_, i) => ({ id: `id${i}`, createdAt: `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z` }));
  it("khong con trang sau (rows <= limit) -> null", () => {
    expect(nextCursorFrom({ hasTerm: false, rows: rows.slice(0, 20), limit: 20, prevOffset: 0 })).toBeNull();
  });
  it("browse -> keyset tu row thu 'limit'", () => {
    const c = nextCursorFrom({ hasTerm: false, rows, limit: 20, prevOffset: 0 });
    expect(c).toEqual({ mode: "keyset", createdAt: rows[19].createdAt, id: "id19" });
  });
  it("search -> offset += limit", () => {
    const c = nextCursorFrom({ hasTerm: true, rows, limit: 20, prevOffset: 40 });
    expect(c).toEqual({ mode: "offset", offset: 60 });
  });
});
