const SEP = "  •  ";

export function dateRange(a: string, b: string): string {
  return [a, b].filter(Boolean).join(" - ");
}

export function contactLine(email: string, phone: string, location?: string): string {
  return [email, phone, location].filter(Boolean).join(SEP);
}

export function linksLine(linkedin?: string, github?: string, portfolio?: string): string {
  return [linkedin, github, portfolio].filter(Boolean).join(SEP);
}

export function eduSubLine(degree: string, major: string, range: string, gpa?: string): string {
  const parts = [degree, major].filter(Boolean).join(" – ");
  return [parts, range, gpa ? `GPA: ${gpa}` : ""].filter(Boolean).join(SEP);
}
