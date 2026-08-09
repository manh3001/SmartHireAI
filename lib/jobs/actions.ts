"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { jobSchema } from "./schema";
import { parseSalaryInput } from "./salary";
import { notifyMatchingAlerts } from "./alert-notify";

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
    category: String(formData.get("category") ?? ""),
    employmentType: String(formData.get("employmentType") ?? ""),
    experienceLevel: String(formData.get("experienceLevel") ?? ""),
    salaryMin: parseSalaryInput(String(formData.get("salaryMin") ?? "")),
    salaryMax: parseSalaryInput(String(formData.get("salaryMax") ?? "")),
    salaryNegotiable: formData.get("salaryNegotiable") === "1",
  });
  if (!parsed.success) redirect("/jobs/new");

  const job = await prisma.jobDescription.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      company: parsed.data.company,
      rawText: parsed.data.rawText,
      location: parsed.data.location,
      skills: parsed.data.skills,
      category: parsed.data.category,
      employmentType: parsed.data.employmentType,
      experienceLevel: parsed.data.experienceLevel,
      salaryMin: parsed.data.salaryMin,
      salaryMax: parsed.data.salaryMax,
      salaryNegotiable: parsed.data.salaryNegotiable,
      isPublic: true,
    },
  });

  await notifyMatchingAlerts({
    id: job.id,
    userId: job.userId,
    title: job.title,
    company: job.company,
    rawText: job.rawText,
    location: job.location,
    skills: job.skills,
    category: job.category,
    employmentType: job.employmentType,
    experienceLevel: job.experienceLevel,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
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
