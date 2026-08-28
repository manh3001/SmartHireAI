"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";
import prisma from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { companySchema } from "./schema";
import { validateLogo } from "./logo";

export async function upsertCompanyProfile(formData: FormData): Promise<void> {
  const session = await requireRole("RECRUITER");

  const parsed = companySchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
    location: String(formData.get("location") ?? "").trim(),
  });
  if (!parsed.success) redirect("/company/edit");

  const removeLogo = formData.get("removeLogo") === "1";
  const logo = formData.get("logo");

  const profile = await prisma.companyProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.data },
    update: { ...parsed.data },
    select: { id: true, logoUrl: true },
  });

  if (removeLogo) {
    if (profile.logoUrl?.includes("vercel-storage.com")) {
      try { await del(profile.logoUrl); } catch { /* non-fatal */ }
    }
    await prisma.companyProfile.update({
      where: { id: profile.id },
      data: { logoData: null, logoMime: null, logoUrl: "" },
    });
  } else if (logo instanceof File && logo.size > 0) {
    const check = validateLogo({ type: logo.type, size: logo.size });
    if (!check.ok) {
      redirect("/company/edit?error=" + encodeURIComponent(check.error));
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      redirect("/company/edit?error=" + encodeURIComponent("Chưa cấu hình BLOB_READ_WRITE_TOKEN"));
    }
    if (profile.logoUrl?.includes("vercel-storage.com")) {
      try { await del(profile.logoUrl); } catch { /* non-fatal */ }
    }
    const buffer = Buffer.from(await logo.arrayBuffer());
    const blob = await put(`logos/${profile.id}`, buffer, {
      access: "public",
      contentType: logo.type,
    });
    await prisma.companyProfile.update({
      where: { id: profile.id },
      data: { logoUrl: blob.url, logoData: null, logoMime: null },
    });
  }

  revalidatePath("/company/edit");
  redirect("/dashboard");
}
