// Server-to-server twin of app/api/mock/whatsapp-chat/route.ts, called only by Niriksh's own
// Python backend (backend/app/modules/whatsapp/) once a real Meta webhook is wired in — never
// reachable from a browser. Same runChatTurn() engine as the public mock demo, so the real
// WhatsApp bot can't drift from what /whatsapp shows: this route exists purely so a process
// that isn't Node/Next (FastAPI) can call it over HTTP, not to add any new behavior.
//
// Authenticated with a dedicated shared secret (WHATSAPP_INTERNAL_KEY) distinct from officer
// session cookies, BACKEND_INTERNAL_API_KEY, and the Bhumika integration key — this key must
// never reach a browser or a NEXT_PUBLIC_ variable.

import { NextResponse } from "next/server";
import { runChatTurn, ChatTurnInput } from "@/lib/whatsapp-chat-engine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const expected = process.env.WHATSAPP_INTERNAL_KEY;
  if (!expected) return NextResponse.json({ error: "WhatsApp internal channel not configured" }, { status: 503 });
  const provided = req.headers.get("x-niriksh-internal-key");
  if (!provided || provided !== expected) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: ChatTurnInput;
  try { body = await req.json() as ChatTurnInput; } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  try {
    return NextResponse.json(await runChatTurn(body));
  } catch (err) {
    console.error("[whatsapp-internal-turn] error:", err);
    return NextResponse.json({ error: "processing failed", detail: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
