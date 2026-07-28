import { renderToBuffer } from "@react-pdf/renderer";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { CvDocument } from "@/lib/pdf/CvDocument";
import type { CvInput } from "@/lib/cv/types";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Chưa đăng nhập", { status: 401 });
  }

  const cv = await prisma.cV.findFirst({
    where: { id, userId: session.user.id },
    include: {
      profile: true,
      experiences: { orderBy: { order: "asc" } },
      educations: { orderBy: { order: "asc" } },
      skills: { orderBy: { order: "asc" } },
      projects: { orderBy: { order: "asc" } },
    },
  });
  if (!cv) return new Response("Không tìm thấy CV", { status: 404 });

  const data: CvInput = {
    title: cv.title,
    profile: {
      fullName: cv.profile?.fullName ?? "",
      headline: cv.profile?.headline ?? "",
      email: cv.profile?.email ?? "",
      phone: cv.profile?.phone ?? "",
      summary: cv.profile?.summary ?? "",
    },
    experiences: cv.experiences.map((e) => ({
      company: e.company, position: e.position,
      startDate: e.startDate, endDate: e.endDate, description: e.description,
    })),
    educations: cv.educations.map((e) => ({
      school: e.school, major: e.major, startDate: e.startDate, endDate: e.endDate,
    })),
    skills: cv.skills.map((sk) => ({ name: sk.name, level: sk.level })),
    projects: cv.projects.map((pr) => ({
      name: pr.name, description: pr.description, tech: pr.tech, link: pr.link,
    })),
  };

  const buffer = await renderToBuffer(<CvDocument cv={data} />);
  const safeTitle = (cv.title || "cv").replace(/[^a-zA-Z0-9-_]+/g, "_");

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
    },
  });
}
