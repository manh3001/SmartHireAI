import prisma from "@/lib/db/prisma";
import type { CvInput } from "./types";

export async function loadCvInput(
  cvId: string,
  userId: string,
): Promise<CvInput | null> {
  const cv = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    include: {
      profile: true,
      experiences: { orderBy: { order: "asc" } },
      educations: { orderBy: { order: "asc" } },
      skills: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
    },
  });
  if (!cv) return null;
  return {
    title: cv.title,
    profile: {
      fullName: cv.profile?.fullName ?? "",
      headline: cv.profile?.headline ?? "",
      email: cv.profile?.email ?? "",
      phone: cv.profile?.phone ?? "",
      summary: cv.profile?.summary ?? "",
    },
    experiences: cv.experiences.map((e) => ({
      company: e.company,
      position: e.position,
      startDate: e.startDate,
      endDate: e.endDate,
      description: e.description,
    })),
    educations: cv.educations.map((e) => ({
      school: e.school,
      major: e.major,
      startDate: e.startDate,
      endDate: e.endDate,
    })),
    skills: cv.skills.map((s) => ({ name: s.name, level: s.level })),
    projects: cv.projects.map((p) => ({
      name: p.name,
      description: p.description,
      tech: p.tech,
      link: p.link,
    })),
  };
}
