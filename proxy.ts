import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Local-only demo switch. Production is always protected because the ECS
  // deployment runs NODE_ENV=production and does not set this variable.
  if (process.env.NODE_ENV !== "production" && process.env.DISABLE_OFFICER_AUTH === "true") {
    return NextResponse.next();
  }
  if (!request.cookies.get("niriksh_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/prevention/:path*", "/awareness/:path*", "/routing/:path*", "/admin/:path*", "/cases/:path*"],
};
