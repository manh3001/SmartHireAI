"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import prisma from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { cvSchema } from "./schema";
import { normalizeCv } from "./normalize";
import type { CvInput } from "./types";
import { normalizeTemplate, type CvTemplate } from "./templates";
import { normalizeAccent, type CvAccent } from "./accents";
import { normalizeFont, type CvFont } from "./fonts";

const CV_LIMIT = 3;

async function requireUserId(): Promise<string> {
  const session = await requireUser();
  return session.user.id;
}

export async function createCv(_formData?: FormData): Promise<void> {
  const userId = await requireUserId();
  const count = await prisma.cV.count({ where: { userId } });
  if (count >= CV_LIMIT) {
    throw new Error(`Đã đạt giới hạn ${CV_LIMIT} CV`);
  }
  const isFirst = count === 0;
  const cv = await prisma.cV.create({
    data: {
      userId,
      title: "CV chưa đặt tên",
      isDefault: isFirst,
      profile: { create: { fullName: "" } },
    },
    select: { id: true },
  });
  redirect(`/cv/${cv.id}`);
}

export async function renameCv(
  id: string,
  title: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };
  await prisma.cV.update({ where: { id }, data: { title: title.trim() || "CV chưa đặt tên" } });
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { ok: true };
}

export async function setDefaultCv(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };
  await prisma.$transaction(async (tx) => {
    await tx.cV.updateMany({ where: { userId }, data: { isDefault: false } });
    await tx.cV.update({ where: { id }, data: { isDefault: true } });
  });
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { ok: true };
}

export async function deleteCv(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get("id") ?? "");

  const cv = await prisma.cV.findFirst({
    where: { id, userId },
    select: { id: true, isDefault: true },
  });
  if (!cv) return;

  if (cv.isDefault) {
    const otherCount = await prisma.cV.count({ where: { userId, id: { not: id } } });
    if (otherCount > 0) {
      // Không cho xóa CV mặc định khi còn CV khác
      return;
    }
  }

  await prisma.cV.deleteMany({ where: { id, userId } });
  revalidateTag(CACHE_TAGS.dashboard, "max");
}

export async function enableShare(
  id: string,
): Promise<{ ok: boolean; token?: string; error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };
  const token = randomBytes(9).toString("base64url");
  await prisma.cV.update({ where: { id }, data: { shareToken: token } });
  revalidateTag(CACHE_TAGS.cv, "max");
  return { ok: true, token };
}

export async function disableShare(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireUserId();
  const owned = await prisma.cV.findFirst({ where: { id, userId }, select: { id: true } });
  if (!owned) return { ok: false, error: "Không tìm thấy CV" };
  await prisma.cV.update({ where: { id }, data: { shareToken: null } });
  revalidateTag(CACHE_TAGS.cv, "max");
  return { ok: true };
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

    await tx.language.deleteMany({ where: { cvId } });
    await tx.language.createMany({
      data: data.languages.map((l, i) => ({ ...l, cvId, order: i })),
    });

    await tx.certification.deleteMany({ where: { cvId } });
    await tx.certification.createMany({
      data: data.certifications.map((c, i) => ({ ...c, cvId, order: i })),
    });
  });

  revalidateTag(CACHE_TAGS.cv, "max");
  revalidateTag(CACHE_TAGS.dashboard, "max");
  return { ok: true };
}
