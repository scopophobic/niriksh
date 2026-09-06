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
// Two tiers, and the client drives both:
//   mode: "skim" — text only, Flash-Lite, fields only.
//   mode: "full" (default) — the real multimodal read: media, transcript, summary, values.

import { NextResponse } from "next/server";
import {
  analyzeFull, analyzeSkim, nextReply, skimReply, sendButtons, detectConfirmation,
  mergeFields, mergeValues, missingFields, checklistView, blankFields, CATEGORIES,
  CategoryKey, Fields, Values,
} from "@/lib/whatsapp-classifier";

export const runtime = "nodejs";

interface ChatRequestBody {
  mode?: "skim" | "full";
  type?: "text" | "image" | "audio" | "document" | "button";
  text?: string;
  history?: string[];
  mediaBase64?: string;
  mimeType?: string;
  pendingMedia?: string | null;
  buttonId?: "send_now" | "dont_send";
  category?: CategoryKey | null;
  checklist?: Fields | null;
  values?: Values | null;
  summary?: string;
}

function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === "string" && value in CATEGORIES;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try { body = await req.json() as ChatRequestBody; } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const {
    mode = "full", type = "text", text = "", history = [], mediaBase64, mimeType,
    pendingMedia = null, buttonId,
    category: rawLockedCategory = null, checklist: priorChecklist = null,
    values: priorValues = null, summary: priorSummary = "",
  } = body;
  const lockedCategory = isCategoryKey(rawLockedCategory) ? rawLockedCategory : null;

  // The client fires the skim and full tiers CONCURRENTLY for every turn, including a button
  // tap. A button/confirmation is a side effect (it flips readyToSubmit), so only the full
  // tier may report it — the skim tier stops here for any button.
  if (type === "button" && mode === "skim") return NextResponse.json({ skipped: true });

  // --- Send now / Don't send ---
  if (type === "button" && buttonId === "send_now") {
    const { required } = lockedCategory
      ? missingFields(lockedCategory, priorChecklist || blankFields(lockedCategory), priorValues || {})
      : { required: ["_no_case"] };
    if (required.length || !lockedCategory) {
      return NextResponse.json({
        messages: [{ kind: "text", body: "Not ready yet — a few required details are still missing above. Fill those in and I'll send it." }],
        category: lockedCategory, checklist: priorChecklist, values: priorValues, summary: priorSummary,
      });
    }
    return NextResponse.json({
      readyToSubmit: true,
      category: lockedCategory,
      categoryLabel: CATEGORIES[lockedCategory].label,
      checklist: priorChecklist || blankFields(lockedCategory),
      values: priorValues || {},
      summary: priorSummary,
    });
  }
  if (type === "button" && buttonId === "dont_send") {
    return NextResponse.json({
      discarded: true,
      messages: [{ kind: "text", body: "🗑️ No worries — this one's been dropped. Send a new message anytime to start a fresh report." }],
    });
  }
  if (type === "button") {
    return NextResponse.json({
      messages: mode === "skim" ? [] : [{ kind: "text", body: "I mainly need the details of what happened — could you tell me more, or share a screenshot?" }],
      category: lockedCategory, checklist: priorChecklist, values: priorValues, summary: priorSummary,
    });
  }

  const textHistory = [...history.filter(Boolean), text].filter(Boolean);

  // --- Typed confirmation ---
  // Gated on the case being genuinely ready — a "yes" answering some earlier question is not
  // consent to file. The skim tier never reaches this path.
  if (mode !== "skim" && type === "text" && lockedCategory && detectConfirmation(text)) {
    const { required } = missingFields(lockedCategory, priorChecklist || blankFields(lockedCategory), priorValues || {});
    if (!required.length) {
      return NextResponse.json({
        readyToSubmit: true,
        category: lockedCategory,
        categoryLabel: CATEGORIES[lockedCategory].label,
        checklist: priorChecklist || blankFields(lockedCategory),
        values: priorValues || {},
        summary: priorSummary,
      });
    }
    // Not ready: fall through and let the normal pass answer.
  }

  try {
    // --- Fast tier: ticks now, from the words alone. ---
    if (mode === "skim") {
      const skim = await analyzeSkim({ textHistory, lockedCategory });
      if (!skim) return NextResponse.json({ skipped: true });

      const category = lockedCategory || skim.category;
      const fields = mergeFields(category, priorChecklist, skim.fields);
      return NextResponse.json({
        provisional: true,
        messages: pendingMedia ? [{ kind: "text", body: skimReply({ category, fields, pendingMedia }) }] : [],
        category,
        categoryLabel: CATEGORIES[category].label,
        checklist: fields,
        checklistView: checklistView(category, fields, priorValues || {}),
        values: priorValues || {},
        summary: priorSummary,
      });
    }

    // --- Full tier: the real multimodal read. ---
    const media = mediaBase64 ? [{ mimeType: mimeType || "application/octet-stream", base64: mediaBase64 }] : [];
    const understood = await analyzeFull({ textHistory, media, lockedCategory });
    const category = lockedCategory || understood.category;
    const fields = mergeFields(category, priorChecklist, understood.fields);
    const values = mergeValues(category, priorValues, understood.values);

    const retracted = understood.retract || [];
    for (const key of retracted) { fields[key] = false; delete values[key]; }

    const summary = understood.summary || priorSummary;
    const { required, optional } = missingFields(category, fields, values);
    const ready = required.length === 0;
    const reply = nextReply({ category, fields, values, summary, retracted });

    return NextResponse.json({
      messages: [{ kind: "buttons", body: reply, buttons: sendButtons(ready) }],
      category,
      categoryLabel: CATEGORIES[category].label,
      checklist: fields,
      checklistView: checklistView(category, fields, values),
      values,
      retracted,
      ready,
      missingOptionalCount: optional.length,
      summary,
    });
  } catch (err) {
    console.error("[whatsapp-chat] error:", err);
    return NextResponse.json({ error: "processing failed", detail: String(err instanceof Error ? err.message : err) }, { status: 500 });
  }
}
