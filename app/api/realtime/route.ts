import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getNotificationSignal } from "@/lib/notifications/poll";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  const signal = await getNotificationSignal(userId);
  return NextResponse.json(
    { authenticated: true, ...signal },
    { headers: { "Cache-Control": "no-store" } },
  );
}
