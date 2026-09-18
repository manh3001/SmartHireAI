"use server";

import prisma from "@/lib/db/prisma";
import { signOut } from "@/auth";
import { requireUser } from "@/lib/auth/session";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit/log";

export async function revokeAllSessions(): Promise<void> {
  const session = await requireUser();
  const userId = session.user!.id as string;

  await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
  });

  await recordAudit(
    { action: AUDIT_ACTIONS.sessionRevokeAll, userId },
    {
      save: (en) =>
        prisma.auditLog
          .create({
            data: {
              action: en.action,
              userId: en.userId ?? undefined,
              targetId: en.targetId ?? undefined,
              ip: en.ip ?? undefined,
            },
          })
          .then(() => undefined),
    },
  );

  await signOut({ redirectTo: "/login" });
}
