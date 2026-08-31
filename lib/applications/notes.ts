"use server";

import { auth } from "@/auth";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import prisma from "@/lib/db/prisma";
import { runAddNote, type AddNoteDeps } from "./notes-logic";

export async function addNote(
  applicationId: string,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Chưa đăng nhập" };
  if (session.user.role !== "RECRUITER")
    return { ok: false, error: "Chỉ nhà tuyển dụng" };

  const deps: AddNoteDeps = {
    findApplicationForRecruiter: (appId, recruiterId) =>
      prisma.application.findFirst({
        where: { id: appId, job: { userId: recruiterId } },
        select: { id: true },
      }),
    createNote: async (data) => {
      await prisma.applicantNote.create({ data });
    },
  };

  const outcome = await runAddNote(
    { applicationId, recruiterId: userId, content },
    deps,
  );
  if (outcome.ok) revalidateTag(CACHE_TAGS.applications, "max");
  return outcome;
}
