import prisma from "@/lib/db/prisma";

export function tallySkills(rows: { skills: string }[], limit = 8): string[] {
  const counts = new Map<string, { display: string; count: number }>();

  for (const row of rows) {
    const seen = new Set<string>();
    for (const raw of (row.skills ?? "").split(",")) {
      const skill = raw.trim();
      if (!skill) continue;
      const key = skill.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) entry.count += 1;
      else counts.set(key, { display: skill, count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.display.localeCompare(b.display, "vi"))
    .slice(0, limit)
    .map((e) => e.display);
}

export async function topSkills(limit = 8): Promise<string[]> {
  const rows = await prisma.jobDescription.findMany({
    where: { isPublic: true },
    select: { skills: true },
  });
  return tallySkills(rows, limit);
}
