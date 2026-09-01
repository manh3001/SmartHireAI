"use server";

import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import prisma from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";
import { runUpsertProfile } from "./profile-logic";
import type { ProfileInput } from "./profile-logic";

export type { ProfileInput };

export async function upsertCandidateProfile(
  data: ProfileInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("CANDIDATE");
  const userId = session.user.id;

  const result = await runUpsertProfile(userId, data, {
    findByUsername: (username) =>
      prisma.candidateProfile.findUnique({
        where: { username },
        select: { userId: true },
      }),
    upsertProfile: (uid, d) =>
      prisma.candidateProfile.upsert({
        where: { userId: uid },
        create: { userId: uid, ...d },
        update: d,
      }),
  });

  if (result.ok) {
    revalidateTag(CACHE_TAGS.candidateProfile, "max");
  }
  return result;
}
