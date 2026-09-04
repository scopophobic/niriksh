import { NextResponse } from "next/server";
import { backendRequest, backendUnavailable } from "@/lib/backend";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const upstream = await backendRequest("/auth/login", { method: "POST", body }, request, true);
    const payload = await upstream.json() as { access_token?: string; expires_in?: number; role?: string; detail?: string };
    if (!upstream.ok || !payload.access_token) {
      return NextResponse.json({ error: payload.detail || "Invalid credentials" }, { status: upstream.status });
    }
    const response = NextResponse.json({ authenticated: true, role: payload.role });
    response.cookies.set("niriksh_session", payload.access_token, {
      httpOnly: true,
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      sameSite: "strict",
      path: "/",
      maxAge: payload.expires_in || 3600,
    });
    return response;
  } catch (error) {
    return backendUnavailable(error);
  }
}
