export type CvTemplate = "classic" | "modern" | "sidebar";

export const CV_TEMPLATES = [
  { id: "classic", label: "Classic", description: "Một cột, gọn gàng, trung tính." },
  { id: "modern", label: "Modern", description: "Dải header màu nhấn, một cột." },
  { id: "sidebar", label: "Sidebar", description: "Hai cột: liên hệ & kỹ năng bên trái." },
] as const satisfies readonly { id: CvTemplate; label: string; description: string }[];

const IDS = new Set<string>(CV_TEMPLATES.map((t) => t.id));

export function isCvTemplate(v: unknown): v is CvTemplate {
  return typeof v === "string" && IDS.has(v);
}

export function normalizeTemplate(v: unknown): CvTemplate {
  return isCvTemplate(v) ? v : "classic";
}
