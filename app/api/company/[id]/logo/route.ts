import prisma from "@/lib/db/prisma";
import { isLogoMime } from "@/lib/company/logo";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const profile = await prisma.companyProfile.findUnique({
    where: { id },
    select: { logoData: true, logoMime: true },
  });
  if (!profile?.logoData || !profile.logoMime || !isLogoMime(profile.logoMime)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(profile.logoData), {
    status: 200,
    headers: {
      "Content-Type": profile.logoMime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
