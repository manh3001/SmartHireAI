import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { routeDecision } from "@/lib/auth/route-rules";

export default auth((req) => {
  const decision = routeDecision(req.nextUrl.pathname, req.auth);

  if (decision === "login") {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  if (decision === "forbidden") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  // allow -> không trả gì, request đi tiếp
});

export const config = {
  // Bỏ qua api (tự guard), static, image, favicon
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
