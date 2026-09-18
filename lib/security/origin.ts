function originOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function isTrustedOrigin(
  h: { origin: string | null; referer: string | null; host: string | null },
  appUrl?: string,
): boolean {
  const allowed = new Set<string>();
  const app = originOf(appUrl ?? null);
  if (app) allowed.add(app);
  if (h.host) {
    allowed.add(`https://${h.host}`);
    allowed.add(`http://${h.host}`);
  }
  // Không có chỉ dấu trình duyệt nào -> không thể kết luận CSRF, cho qua.
  if (!h.origin && !h.referer) return true;
  if (h.origin) return allowed.has(h.origin);
  const refOrigin = originOf(h.referer);
  if (!refOrigin) return false;
  return allowed.has(refOrigin);
}

export function assertSameOrigin(req: Request): boolean {
  return isTrustedOrigin(
    {
      origin: req.headers.get("origin"),
      referer: req.headers.get("referer"),
      host: req.headers.get("host"),
    },
    process.env.APP_URL,
  );
}
