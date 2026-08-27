import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { registerUser } from "@/lib/auth/register";
import { hashPassword } from "@/lib/auth/password";
import { checkRateLimit } from "@/lib/security/ratelimit";
import { getClientIp } from "@/lib/security/ip";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    if (!(await checkRateLimit("register", ip))) {
      return NextResponse.json(
        { error: "Bạn thao tác quá nhiều lần, vui lòng thử lại sau" },
        { status: 429 },
      );
    }

    const body = await req.json();
    const result = await registerUser(body, {
      findByEmail: (email) =>
        prisma.user.findUnique({ where: { email }, select: { id: true } }),
      create: (data) =>
        prisma.user.create({ data, select: { id: true } }),
      hash: hashPassword,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ userId: result.userId }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Có lỗi xảy ra, vui lòng thử lại" },
      { status: 500 },
    );
  }
}
