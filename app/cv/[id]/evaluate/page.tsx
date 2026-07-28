import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/db/prisma";
import EvaluateClient, { type PastEvaluation } from "./EvaluateClient";

export default async function EvaluatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cv = await prisma.cV.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, title: true },
  });
  if (!cv) notFound();

  const rows = await prisma.evaluation.findMany({
    where: { cvId: cv.id, userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      overallScore: true,
      summary: true,
      createdAt: true,
      jobDescription: { select: { title: true, company: true } },
    },
  });

  const history: PastEvaluation[] = rows.map((r) => ({
    id: r.id,
    overallScore: r.overallScore,
    summary: r.summary,
    createdAt: r.createdAt.toISOString(),
    jdTitle: r.jobDescription.title,
    jdCompany: r.jobDescription.company,
  }));

  return <EvaluateClient cvId={cv.id} cvTitle={cv.title} history={history} />;
}
