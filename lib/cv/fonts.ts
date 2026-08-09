export type CvFont = "roboto" | "bevietnam" | "lora";

export type FontDef = {
  id: CvFont;
  label: string;
  pdfFamily: string;
  cssStack: string;
};

export const CV_FONTS = [
  { id: "roboto", label: "Roboto (mặc định)", pdfFamily: "Roboto", cssStack: "" },
  { id: "bevietnam", label: "Be Vietnam Pro", pdfFamily: "Be Vietnam Pro", cssStack: "var(--font-be-vietnam-pro), sans-serif" },
  { id: "lora", label: "Lora (serif)", pdfFamily: "Lora", cssStack: "var(--font-lora), serif" },
] as const satisfies readonly FontDef[];

const FONT_IDS = new Set<string>(CV_FONTS.map((f) => f.id));

export function isCvFont(v: unknown): v is CvFont {
  return typeof v === "string" && FONT_IDS.has(v);
}

export function normalizeFont(v: unknown): CvFont {
  return isCvFont(v) ? v : "roboto";
}

export function fontById(id: CvFont): FontDef {
  return CV_FONTS.find((f) => f.id === id) ?? CV_FONTS[0];
}
