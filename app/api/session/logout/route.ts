import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set("niriksh_session", "", { httpOnly: true, secure: process.env.SESSION_COOKIE_SECURE === "true", sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
