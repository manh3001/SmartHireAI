export function parseFrontmatter(raw: string): { data: Record<string, string>; content: string } {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return { data: {}, content: raw };
  const end = normalized.indexOf("\n---", 4);
  if (end === -1) return { data: {}, content: raw };

  const block = normalized.slice(4, end);
  const data: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) data[key] = value;
  }

  let content = normalized.slice(end + 1); // "---...\n<body>"
  content = content.replace(/^---[^\n]*\n?/, ""); // bỏ dòng fence đóng
  content = content.replace(/^\n+/, ""); // bỏ dòng trống đầu
  return { data, content };
}
