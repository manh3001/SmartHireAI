import { renderToBuffer } from "@react-pdf/renderer";
import prisma from "@/lib/db/prisma";
import { auth } from "@/auth";
import { CvDocument } from "@/lib/pdf/CvDocument";
import { loadCvInput } from "@/lib/cv/load";
import { normalizeTemplate } from "@/lib/cv/templates";
import { normalizeAccent } from "@/lib/cv/accents";
import { normalizeFont } from "@/lib/cv/fonts";

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

  const [data, cv] = await Promise.all([
    loadCvInput(id, session.user.id),
    prisma.cV.findFirst({
      where: { id, userId: session.user.id },
      select: { title: true, template: true, accent: true, font: true },
    }),
  ]);
  if (!data || !cv) return new Response("Không tìm thấy CV", { status: 404 });

  const buffer = await renderToBuffer(
    <CvDocument
      cv={data}
      template={normalizeTemplate(cv.template)}
      accent={normalizeAccent(cv.accent)}
      font={normalizeFont(cv.font)}
    />,
  );
  const safeTitle = (cv.title || "cv").replace(/[^a-zA-Z0-9-_]+/g, "_");

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
    },
  });
}
