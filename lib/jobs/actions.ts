"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { jobSchema } from "./schema";

export async function createJobDescription(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const parsed = jobSchema.safeParse({
    title: String(formData.get("title") ?? "").trim(),
    company: String(formData.get("company") ?? "").trim(),
    rawText: String(formData.get("rawText") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
    skills: String(formData.get("skills") ?? "").trim(),
    employmentType: String(formData.get("employmentType") ?? ""),
    experienceLevel: String(formData.get("experienceLevel") ?? ""),
  });
  if (!parsed.success) redirect("/jobs/new");

  await prisma.jobDescription.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      company: parsed.data.company,
      rawText: parsed.data.rawText,
      location: parsed.data.location,
      skills: parsed.data.skills,
      employmentType: parsed.data.employmentType,
      experienceLevel: parsed.data.experienceLevel,
      isPublic: true,
    },
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
