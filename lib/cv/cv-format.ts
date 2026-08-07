const SEP = "  •  ";

export function dateRange(a: string, b: string): string {
  return [a, b].filter(Boolean).join(" - ");
}

export function contactLine(email: string, phone: string): string {
  return [email, phone].filter(Boolean).join(SEP);
}

export function eduSubLine(major: string, range: string): string {
  return [major, range].filter(Boolean).join(SEP);
}
