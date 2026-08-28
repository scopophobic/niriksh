import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", service: "niriksh", version: process.env.APP_VERSION || "development" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
