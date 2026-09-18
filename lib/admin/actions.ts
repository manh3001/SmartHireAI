"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { CACHE_TAGS } from "@/lib/cache/tags";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "./guard";
import { canDeleteUser } from "./can-delete";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

export async function deleteUserAsAdmin(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return;
  if (!canDeleteUser(session.user.id, target).ok) return;
  await prisma.user.delete({ where: { id } });
  await recordAudit(
    { action: AUDIT_ACTIONS.userDelete, userId: session.user.id, targetId: id },
    {
      save: (en) =>
        prisma.auditLog
          .create({
            data: {
              action: en.action,
              userId: en.userId ?? undefined,
              targetId: en.targetId ?? undefined,
              ip: en.ip ?? undefined,
              metadata: en.metadata != null ? (en.metadata as Prisma.InputJsonValue) : undefined,
            },
          })
          .then(() => undefined),
    },
  );
  revalidatePath("/admin/users");
}

export async function deleteJobAsAdmin(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.jobDescription.deleteMany({ where: { id } });
  revalidatePath("/admin/jobs");
  revalidateTag(CACHE_TAGS.jobs, "max");
}

export async function setJobPublicAsAdmin(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isPublic = formData.get("isPublic") === "1";
  await prisma.jobDescription.updateMany({ where: { id }, data: { isPublic } });
  revalidatePath("/admin/jobs");
  revalidateTag(CACHE_TAGS.jobs, "max");
}
