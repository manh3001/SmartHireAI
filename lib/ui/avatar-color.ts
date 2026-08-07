// Bảng gradient chàm-tím-hồng hợp tông thương hiệu.
const PALETTE: { from: string; to: string }[] = [
  { from: "#6366f1", to: "#a855f7" },
  { from: "#8b5cf6", to: "#ec4899" },
  { from: "#4f46e5", to: "#7c3aed" },
  { from: "#7c3aed", to: "#db2777" },
  { from: "#4338ca", to: "#6d28d9" },
  { from: "#9333ea", to: "#c026d3" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function avatarStyle(name: string): { from: string; to: string } {
  const key = (name || "").trim().toLowerCase() || "?";
  return PALETTE[hash(key) % PALETTE.length];
}

export function initials(name: string): string {
  const words = (name || "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
