// Chat API for the native WhatsApp-style demo at /whatsapp — ported from Bhumika's
// umang-reimagined repo (app/api/mock/niriksh-chat/route.js) per docs/whatsapp-demo.md.
//
// Stateless on the server: no DB row, no session table. The client carries the checklist
// forward instead — every response includes `category` (locked once known), `checklist`
// (the field-boolean map) and `values` (what was actually read for each ticked field), and
// the client echoes all three back on the next request. This turn's fresh Gemini read gets
// OR'd onto that carried-forward checklist (mergeFields) rather than replacing it.
//
// Unlike the Bhumika original, this route never files anything itself — there is no
// Bhumika/niriksh HTTP handoff to call (ADR-046 explicitly ruled that out for this chat; it
// lives natively inside niriksh). When the checklist is complete and the citizen confirms,
// this route only signals `readyToSubmit`; the actual case creation (analyzeComplaint →
// addLocalEngine → useCaseStore().addCase → evidence upload) happens client-side in
// components/WhatsAppDemo.tsx, exactly like ReportFlow.tsx's own submit step.
//
// The actual turn logic lives in lib/whatsapp-chat-engine.ts's runChatTurn() — shared with
// app/api/internal/whatsapp/turn/route.ts, which is what the real Meta-connected WhatsApp bot
// calls. This route is just the public, browser-facing transport around that same engine.

import { NextResponse } from "next/server";
import { runChatTurn, ChatTurnInput } from "@/lib/whatsapp-chat-engine";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: ChatTurnInput;
  try { body = await req.json() as ChatTurnInput; } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  try {
    return NextResponse.json(await runChatTurn(body));
  } catch (err) {
    console.error("[whatsapp-chat] error:", err);
    return NextResponse.json({ error: "processing failed", detail: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
