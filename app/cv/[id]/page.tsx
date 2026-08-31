import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { normalizeTemplate } from "@/lib/cv/templates";
import { normalizeAccent } from "@/lib/cv/accents";
import { normalizeFont } from "@/lib/cv/fonts";
import { loadCvInput } from "@/lib/cv/load";
import prisma from "@/lib/db/prisma";
import CvEditor from "./CvEditor";

export default async function CvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [initial, cv] = await Promise.all([
    loadCvInput(id, session.user.id),
    prisma.cV.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true, template: true, accent: true, font: true, shareToken: true },
    }),
  ]);

  if (!initial || !cv) notFound();

  return (
    <CvEditor
      cvId={cv.id}
      initial={initial}
      initialTemplate={normalizeTemplate(cv.template)}
      initialAccent={normalizeAccent(cv.accent)}
      initialFont={normalizeFont(cv.font)}
      initialShareToken={cv.shareToken ?? null}
    />
  );
}
