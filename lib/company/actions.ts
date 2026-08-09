"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { companySchema } from "./schema";
import { validateLogo } from "./logo";

export async function upsertCompanyProfile(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "RECRUITER") redirect("/dashboard");

  const parsed = companySchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
  });
  if (!parsed.success) redirect("/company/edit");

  const profile = await prisma.companyProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.data },
    update: { ...parsed.data },
    select: { id: true },
  });

  const removeLogo = formData.get("removeLogo") === "1";
  const logo = formData.get("logo");

  if (removeLogo) {
    await prisma.companyProfile.update({
      where: { id: profile.id },
      data: { logoData: null, logoMime: null, logoUrl: "" },
    });
  } else if (logo instanceof File && logo.size > 0) {
    const check = validateLogo({ type: logo.type, size: logo.size });
    if (!check.ok) {
      redirect("/company/edit?error=" + encodeURIComponent(check.error));
    }
    const bytes = Buffer.from(await logo.arrayBuffer());
    await prisma.companyProfile.update({
      where: { id: profile.id },
      data: {
        logoData: bytes,
        logoMime: logo.type,
        logoUrl: "/api/company/" + profile.id + "/logo?v=" + Date.now(),
      },
    });
  }

  revalidatePath("/company/edit");
  redirect("/dashboard");
}
