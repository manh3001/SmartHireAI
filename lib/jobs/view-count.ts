export function recordView(
  cookieValue: string | undefined,
  jobId: string,
  today: string,
): { count: boolean; cookie: string } {
  const raw = cookieValue ?? "";
  const sep = raw.indexOf("|");
  const date = sep === -1 ? "" : raw.slice(0, sep);
  const ids = sep === -1 ? [] : raw.slice(sep + 1).split(",").filter(Boolean);

  if (date !== today) {
    return { count: true, cookie: `${today}|${jobId}` };
  }
  if (ids.includes(jobId)) {
    return { count: false, cookie: raw };
  }
  return { count: true, cookie: `${today}|${[...ids, jobId].join(",")}` };
}
