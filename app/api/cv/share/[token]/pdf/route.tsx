import { renderToBuffer } from "@react-pdf/renderer";
import prisma from "@/lib/db/prisma";
import { loadCvInput } from "@/lib/cv/load";
import { CvDocument } from "@/lib/pdf/CvDocument";
import { normalizeTemplate } from "@/lib/cv/templates";
import { normalizeAccent } from "@/lib/cv/accents";
import { normalizeFont } from "@/lib/cv/fonts";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const cv = await prisma.cV.findUnique({
    where: { shareToken: token },
    select: { id: true, userId: true, title: true, template: true, accent: true, font: true },
  });
  if (!cv) return new Response("Không tìm thấy CV", { status: 404 });

  const data = await loadCvInput(cv.id, cv.userId);
  if (!data) return new Response("Không tìm thấy CV", { status: 404 });

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
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeTitle}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
