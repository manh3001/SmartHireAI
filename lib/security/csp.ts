function sentryConnectSrc(dsn?: string): string {
  if (!dsn) return "";
  try {
    return " " + new URL(dsn).origin;
  } catch {
    return "";
  }
}

export function buildCsp({
  isProd,
  sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN,
}: {
  isProd: boolean;
  sentryDsn?: string;
}): string {
  const scriptSrc = isProd ? "'self'" : "'self' 'unsafe-eval' 'unsafe-inline'";
  const connectSrc = `'self'${sentryConnectSrc(sentryDsn)}`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind v4 + inline style (react-pdf preview)
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
