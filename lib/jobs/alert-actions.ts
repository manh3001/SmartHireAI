"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { alertLabel, type AlertCriteria } from "./alerts";
import { normalizeCategory } from "./job-categories";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, type EmploymentType, type ExperienceLevel } from "./job-fields";
import { SALARY_FILTER_STEPS } from "./salary";

export async function createJobAlert(
  input: AlertCriteria,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "CANDIDATE") return { ok: false, error: "Chỉ ứng viên dùng được" };

  const term = (input.term ?? "").trim();
  const category = normalizeCategory(input.category);
  const employmentType = EMPLOYMENT_TYPES.includes(input.employmentType as never)
    ? (input.employmentType as EmploymentType)
    : null;
  const experienceLevel = EXPERIENCE_LEVELS.includes(input.experienceLevel as never)
    ? (input.experienceLevel as ExperienceLevel)
    : null;
  const salaryMillions = SALARY_FILTER_STEPS.includes(input.salaryMillions as never)
    ? (input.salaryMillions as number)
    : null;

  const criteria: AlertCriteria = {
    ...(term ? { term } : {}),
    ...(category ? { category } : {}),
    ...(employmentType ? { employmentType } : {}),
    ...(experienceLevel ? { experienceLevel } : {}),
    ...(salaryMillions != null ? { salaryMillions } : {}),
  };

  await prisma.jobAlert.create({
    data: {
      userId,
      label: alertLabel(criteria),
      term: term || null,
      category,
      employmentType,
      experienceLevel,
      salaryMillions,
    },
  });

  revalidatePath("/jobs/alerts");
  return { ok: true };
}

export async function deleteJobAlert(id: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.jobAlert.deleteMany({ where: { id, userId } });
  revalidatePath("/jobs/alerts");
}

export async function setAlertEmail(id: string, enabled: boolean): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await prisma.jobAlert.updateMany({ where: { id, userId }, data: { emailEnabled: enabled } });
  revalidatePath("/jobs/alerts");
}
