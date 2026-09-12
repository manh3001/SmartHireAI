import prisma from "@/lib/db/prisma";

export type CandidateCard = {
  cvId: string;
  shareToken: string;
  fullName: string;
  headline: string;
  location: string;
  skills: string[];
  openToWork: boolean;
};

type RawRow = {
  id: string;
  shareToken: string | null;
  profile: { fullName: string; headline: string; location: string } | null;
  skills: { name: string }[];
  _count: { experiences: number };
  openToWork: boolean;
};

export function applyExpFilter(rows: RawRow[], exp: string | undefined): RawRow[] {
  return rows.filter((r) => {
    const n = r._count.experiences;
    if (exp === "0") return n === 0;
    if (exp === "1") return n >= 1 && n <= 4;
    if (exp === "3") return n >= 3 && n <= 8;
    if (exp === "5") return n >= 5;
    return true;
  });
}

export function applyOpenFilter(rows: RawRow[], open: string | undefined): RawRow[] {
  if (open !== "1") return rows;
  return rows.filter((r) => r.openToWork);
}

export function mapToCandidateCards(rows: RawRow[]): CandidateCard[] {
  return rows.map((r) => ({
    cvId: r.id,
    shareToken: r.shareToken!,
    fullName: r.profile?.fullName ?? "",
    headline: r.profile?.headline ?? "",
    location: r.profile?.location ?? "",
    skills: r.skills.map((s) => s.name),
    openToWork: r.openToWork,
  }));
}

export async function searchCandidates(params: {
  q?: string;
  exp?: string;
  open?: string;
}): Promise<CandidateCard[]> {
  const keywords = (params.q ?? "").trim().split(/\s+/).filter(Boolean);

  const keywordOr = keywords.flatMap((kw) => [
    { profile: { fullName: { contains: kw, mode: "insensitive" as const } } },
    { profile: { headline: { contains: kw, mode: "insensitive" as const } } },
    { profile: { location: { contains: kw, mode: "insensitive" as const } } },
    { profile: { summary: { contains: kw, mode: "insensitive" as const } } },
    { skills: { some: { name: { contains: kw, mode: "insensitive" as const } } } },
  ]);

  const rows = await prisma.cV.findMany({
    where: {
      shareToken: { not: null },
      ...(keywordOr.length > 0 ? { OR: keywordOr } : {}),
    },
    select: {
      id: true,
      shareToken: true,
      profile: { select: { fullName: true, headline: true, location: true } },
      skills: { select: { name: true }, take: 4, orderBy: { order: "asc" } },
      _count: { select: { experiences: true } },
      user: { select: { candidateProfile: { select: { openToWork: true } } } },
    },
    take: 100,
    orderBy: { updatedAt: "desc" },
  });

  const flat: RawRow[] = rows.map((r) => ({
    id: r.id,
    shareToken: r.shareToken,
    profile: r.profile,
    skills: r.skills,
    _count: r._count,
    openToWork: r.user?.candidateProfile?.openToWork ?? false,
  }));
  const byExp = applyExpFilter(flat, params.exp);
  const byOpen = applyOpenFilter(byExp, params.open);
  return mapToCandidateCards(byOpen.slice(0, 50));
}
