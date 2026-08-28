export type SearchCursor =
  | { mode: "keyset"; createdAt: string; id: string }
  | { mode: "offset"; offset: number };

export function encodeCursor(c: SearchCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64");
}

export function decodeCursor(s: string | null | undefined): SearchCursor | null {
  if (!s) return null;
  try {
    const o = JSON.parse(Buffer.from(s, "base64").toString("utf8"));
    if (o && o.mode === "keyset" && typeof o.createdAt === "string" && typeof o.id === "string")
      return { mode: "keyset", createdAt: o.createdAt, id: o.id };
    if (o && o.mode === "offset" && typeof o.offset === "number" && o.offset >= 0)
      return { mode: "offset", offset: o.offset };
    return null;
  } catch {
    return null;
  }
}

// rows đã lấy limit+1 để biết còn trang sau. Không còn -> null.
export function nextCursorFrom(p: {
  hasTerm: boolean;
  rows: { id: string; createdAt: Date | string }[];
  limit: number;
  prevOffset: number;
}): SearchCursor | null {
  if (p.rows.length <= p.limit) return null;
  if (p.hasTerm) return { mode: "offset", offset: p.prevOffset + p.limit };
  const last = p.rows[p.limit - 1];
  const createdAt = typeof last.createdAt === "string" ? last.createdAt : last.createdAt.toISOString();
  return { mode: "keyset", createdAt, id: last.id };
}
