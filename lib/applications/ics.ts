export type IcsInput = {
  scheduledAt: Date;
  summary: string;
  location: string;
  description: string;
  uid: string;
};

function fmt(d: Date): string {
  // 2026-09-10T09:00:00.000Z -> 20260910T090000Z
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildIcs(input: IcsInput): string {
  const start = fmt(input.scheduledAt);
  const end = fmt(new Date(input.scheduledAt.getTime() + 60 * 60 * 1000));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SmartHire//Interview//VI",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(input.summary)}`,
    `LOCATION:${esc(input.location)}`,
    `DESCRIPTION:${esc(input.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}
