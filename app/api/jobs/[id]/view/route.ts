import { cookies } from "next/headers";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { recordView } from "@/lib/jobs/view-count";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";
import { assertSameOrigin } from "@/lib/security/origin";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(req)) {
    return new Response("forbidden", { status: 403 });
  }
  const ip = getClientIp(req);
  if (!(await checkRateLimit("mutation", ip))) {
    return new Response(null, { status: 429 });
  }

  const { id } = await params;
  const job = await prisma.jobDescription.findFirst({
    where: { id, isPublic: true },
    select: { userId: true },
  });
  if (!job) return new Response(null, { status: 204 });

  const session = await auth();
  if (session?.user?.id === job.userId) return new Response(null, { status: 204 }); // chủ tin, không đếm

  const store = await cookies();
  const today = new Date().toISOString().slice(0, 10);
  const { count, cookie } = recordView(store.get("viewed")?.value, id, today);
  if (count) {
    await prisma.jobDescription.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    store.set("viewed", cookie, {
      maxAge: 60 * 60 * 24 * 2,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return new Response(null, { status: 204 });
}
