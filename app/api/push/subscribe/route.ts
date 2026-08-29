import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/db/prisma";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as {
    endpoint?: string;
    p256dh?: string;
    auth?: string;
  };
  const { endpoint, p256dh, auth: authKey } = body;
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh, auth: authKey },
    create: { userId, endpoint, p256dh, auth: authKey },
  });

  return NextResponse.json({ ok: true });
}
