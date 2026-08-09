import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import type { CvInput } from "@/lib/cv/types";
import { normalizeTemplate } from "@/lib/cv/templates";
import { normalizeAccent } from "@/lib/cv/accents";
import { normalizeFont } from "@/lib/cv/fonts";
import CvEditor from "./CvEditor";

export default async function CvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cv = await prisma.cV.findFirst({
    where: { id, userId: session.user.id },
    include: {
      profile: true,
      experiences: { orderBy: { order: "asc" } },
      educations: { orderBy: { order: "asc" } },
      skills: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
    },
  });
  if (!cv) notFound();

  const initial: CvInput = {
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

  return (
    <CvEditor
      cvId={cv.id}
      initial={initial}
      initialTemplate={normalizeTemplate(cv.template)}
      initialAccent={normalizeAccent(cv.accent)}
      initialFont={normalizeFont(cv.font)}
    />
  );
}
