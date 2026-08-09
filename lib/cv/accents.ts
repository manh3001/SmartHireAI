export type CvAccent = "indigo" | "blue" | "emerald" | "rose" | "amber" | "slate";

export type AccentDef = {
  id: CvAccent;
  label: string;
  hex: string;
  soft: string;
  onDark: string;
};

export const CV_ACCENTS = [
  { id: "indigo", label: "Chàm", hex: "#4f46e5", soft: "#eef2ff", onDark: "#e0e7ff" },
  { id: "blue", label: "Xanh dương", hex: "#2563eb", soft: "#eff6ff", onDark: "#dbeafe" },
  { id: "emerald", label: "Lục", hex: "#059669", soft: "#ecfdf5", onDark: "#d1fae5" },
  { id: "rose", label: "Đỏ mận", hex: "#e11d48", soft: "#fff1f2", onDark: "#ffe4e6" },
  { id: "amber", label: "Cam", hex: "#d97706", soft: "#fffbeb", onDark: "#fef3c7" },
  { id: "slate", label: "Xám than", hex: "#334155", soft: "#f1f5f9", onDark: "#e2e8f0" },
] as const satisfies readonly AccentDef[];

const ACCENT_IDS = new Set<string>(CV_ACCENTS.map((a) => a.id));

export function isCvAccent(v: unknown): v is CvAccent {
  return typeof v === "string" && ACCENT_IDS.has(v);
}

export function normalizeAccent(v: unknown): CvAccent {
  return isCvAccent(v) ? v : "indigo";
}

export function accentById(id: CvAccent): AccentDef {
  return CV_ACCENTS.find((a) => a.id === id) ?? CV_ACCENTS[0];
}
