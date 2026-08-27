export function buildCsp({ isProd }: { isProd: boolean }): string {
  const scriptSrc = isProd ? "'self'" : "'self' 'unsafe-eval'";
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind v4 + inline style (react-pdf preview)
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:", // Neon/Upstash/Gemini
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
