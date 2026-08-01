"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { requireAdmin } from "./guard";
import { canDeleteUser } from "./can-delete";

export async function deleteUserAsAdmin(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return;
  if (!canDeleteUser(session.user!.id, target).ok) return;
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/users");
}

export async function deleteJobAsAdmin(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.jobDescription.deleteMany({ where: { id } });
  revalidatePath("/admin/jobs");
}

export async function setJobPublicAsAdmin(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const isPublic = formData.get("isPublic") === "1";
  await prisma.jobDescription.updateMany({ where: { id }, data: { isPublic } });
  revalidatePath("/admin/jobs");
}
