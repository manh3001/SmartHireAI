"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";

export async function createJobDescription(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const title = String(formData.get("title") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const rawText = String(formData.get("rawText") ?? "").trim();
  if (!rawText) redirect("/jobs/new");

  await prisma.jobDescription.create({
    data: { userId: session.user.id, title, company, rawText, isPublic: true },
  });
  redirect("/dashboard");
}

export async function deleteJobDescription(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await prisma.jobDescription.deleteMany({ where: { id, userId: session.user.id } });
  revalidatePath("/dashboard");
}
