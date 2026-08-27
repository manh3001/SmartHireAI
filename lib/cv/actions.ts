"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { cvSchema } from "./schema";
import { normalizeCv } from "./normalize";
import type { CvInput } from "./types";
import { normalizeTemplate, type CvTemplate } from "./templates";
import { normalizeAccent, type CvAccent } from "./accents";
import { normalizeFont, type CvFont } from "./fonts";

async function requireUserId(): Promise<string> {
  const session = await requireUser();
  return session.user.id;
}

export async function createCv(): Promise<void> {
  const userId = await requireUserId();
  const cv = await prisma.cV.create({
    data: {
      userId,
      title: "CV chưa đặt tên",
      profile: { create: { fullName: "" } },
    },
    select: { id: true },
  });
  redirect(`/cv/${cv.id}`);
}

export async function deleteCv(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");
  await prisma.cV.deleteMany({ where: { id, userId } });
  revalidatePath("/dashboard");
}

export async function saveCv(
  cvId: string,
  input: CvInput,
  template?: CvTemplate,
  accent?: CvAccent,
  font?: CvFont,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();

  const owned = await prisma.cV.findFirst({
    where: { id: cvId, userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };

  const data = normalizeCv(input);
  const parsed = cvSchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await prisma.$transaction(async (tx) => {
    await tx.cV.update({
      where: { id: cvId },
      data: {
        title: data.title || "CV chưa đặt tên",
        template: normalizeTemplate(template),
        accent: normalizeAccent(accent),
        font: normalizeFont(font),
      },
    });
    await tx.profile.upsert({
      where: { cvId },
      create: { cvId, ...data.profile },
      update: { ...data.profile },
    });

    await tx.experience.deleteMany({ where: { cvId } });
    await tx.experience.createMany({
      data: data.experiences.map((e, i) => ({ ...e, cvId, order: i })),
    });

    await tx.education.deleteMany({ where: { cvId } });
    await tx.education.createMany({
      data: data.educations.map((e, i) => ({ ...e, cvId, order: i })),
    });

    await tx.skill.deleteMany({ where: { cvId } });
    await tx.skill.createMany({
      data: data.skills.map((s, i) => ({ ...s, cvId, order: i })),
    });

    await tx.project.deleteMany({ where: { cvId } });
    await tx.project.createMany({
      data: data.projects.map((p, i) => ({ ...p, cvId, order: i })),
    });
  });

  revalidatePath(`/cv/${cvId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
