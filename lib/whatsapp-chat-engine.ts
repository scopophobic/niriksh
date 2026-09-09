// The one turn-processing engine behind the WhatsApp-style chat — extracted from
// app/api/mock/whatsapp-chat/route.ts so the public mock demo AND the internal route that
// backs the real Meta-connected bot (app/api/internal/whatsapp/turn/route.ts) call the exact
// same code path. Whatever decides what to ask/say next lives in exactly one place; there is
// nothing channel-specific in here.
//
// Also composes `complaintDetails`/`narrative` (via lib/whatsapp-mapping.ts) whenever a
// category is known, so a caller that needs to persist a case — the real WhatsApp webhook,
// which has no browser to run WhatsAppDemo.tsx's own submitCase() — never has to reimplement
// the checklist-to-complaint mapping rules itself.

import {
  analyzeFull, analyzeSkim, nextReply, skimReply, sendButtons, detectConfirmation,
  mergeFields, mergeValues, missingFields, checklistView, blankFields, CATEGORIES,
  CategoryKey, ChatButton, ChecklistRow, Fields, Values,
} from "@/lib/whatsapp-classifier";
import { resolveLanguage, t, LangKey } from "@/lib/whatsapp-i18n";
import { checklistToComplaintDetails, buildNarrative } from "@/lib/whatsapp-mapping";
import { ComplaintDetails } from "@/lib/types";

export interface ChatTurnInput {
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
  language?: string | null;
}

export interface ChatTurnMessage {
  kind: string;
  body: string;
  buttons?: ChatButton[];
}

export interface ChatTurnResult {
  messages?: ChatTurnMessage[];
  category?: CategoryKey | null;
  categoryLabel?: string;
  checklist?: Fields | null;
  checklistView?: ChecklistRow[];
  values?: Values | null;
  summary?: string;
  language?: LangKey;
  ready?: boolean;
  retracted?: string[];
  skipped?: boolean;
  provisional?: boolean;
  discarded?: boolean;
  readyToSubmit?: boolean;
  missingOptionalCount?: number;
  complaintDetails?: ComplaintDetails;
  narrative?: string;
}

function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === "string" && value in CATEGORIES;
}

function mapping(category: CategoryKey, values: Values, summary: string, confirmed: boolean) {
  return {
    complaintDetails: checklistToComplaintDetails({ category, values, confirmed }),
    narrative: buildNarrative({ category, values, summary }),
  };
}

export async function runChatTurn(body: ChatTurnInput): Promise<ChatTurnResult> {
  const {
    mode = "full", type = "text", text = "", history = [], mediaBase64, mimeType,
    pendingMedia = null, buttonId,
    category: rawLockedCategory = null, checklist: priorChecklist = null,
    values: priorValues = null, summary: priorSummary = "",
    language: rawPriorLanguage = null,
  } = body;
  const lockedCategory = isCategoryKey(rawLockedCategory) ? rawLockedCategory : null;
  // Locked exactly like category once a turn has ever set it: a citizen who opens in Hindi
  // stays in Hindi even if a later turn's text is ambiguous or code-switches in an English
  // word/number and Gemini's per-turn guess comes back "English" -- that used to flip the
  // whole reply language mid-conversation, which reads as broken, not helpful. `rawPriorLanguage`
  // is only ever null on the very first turn of a session (nothing carried forward yet); any
  // later turn always echoes back a real value, so its mere presence IS the lock signal.
  const languageLocked = Boolean(rawPriorLanguage);
  const priorLanguage: LangKey = resolveLanguage(rawPriorLanguage);

  // The client fires the skim and full tiers CONCURRENTLY for every turn, including a button
  // tap. A button/confirmation is a side effect (it flips readyToSubmit), so only the full
  // tier may report it — the skim tier stops here for any button.
  if (type === "button" && mode === "skim") return { skipped: true };

  // --- Send now / Don't send ---
  if (type === "button" && buttonId === "send_now") {
    const { required } = lockedCategory
      ? missingFields(lockedCategory, priorChecklist || blankFields(lockedCategory), priorValues || {})
      : { required: ["_no_case"] };
    if (required.length || !lockedCategory) {
      return {
        messages: [{ kind: "text", body: t("route_not_ready", priorLanguage) }],
        category: lockedCategory, checklist: priorChecklist, values: priorValues, summary: priorSummary,
        language: priorLanguage,
      };
    }
    const values = priorValues || {};
    return {
      readyToSubmit: true,
      category: lockedCategory,
      categoryLabel: CATEGORIES[lockedCategory].label,
      checklist: priorChecklist || blankFields(lockedCategory),
      values,
      summary: priorSummary,
      language: priorLanguage,
      ...mapping(lockedCategory, values, priorSummary, true),
    };
  }
  if (type === "button" && buttonId === "dont_send") {
    return {
      discarded: true,
      messages: [{ kind: "text", body: t("route_discarded", priorLanguage) }],
      language: priorLanguage,
    };
  }
  if (type === "button") {
    return {
      messages: mode === "skim" ? [] : [{ kind: "text", body: t("route_need_more", priorLanguage) }],
      category: lockedCategory, checklist: priorChecklist, values: priorValues, summary: priorSummary,
      language: priorLanguage,
    };
  }

  const textHistory = [...history.filter(Boolean), text].filter(Boolean);

  // --- Typed confirmation ---
  // Gated on the case being genuinely ready — a "yes" answering some earlier question is not
  // consent to file. The skim tier never reaches this path.
  if (mode !== "skim" && type === "text" && lockedCategory && detectConfirmation(text)) {
    const { required } = missingFields(lockedCategory, priorChecklist || blankFields(lockedCategory), priorValues || {});
    if (!required.length) {
      const values = priorValues || {};
      return {
        readyToSubmit: true,
        category: lockedCategory,
        categoryLabel: CATEGORIES[lockedCategory].label,
        checklist: priorChecklist || blankFields(lockedCategory),
        values,
        summary: priorSummary,
        language: priorLanguage,
        ...mapping(lockedCategory, values, priorSummary, true),
      };
    }
    // Not ready: fall through and let the normal pass answer.
  }

  // --- Fast tier: ticks now, from the words alone. ---
  if (mode === "skim") {
    const skim = await analyzeSkim({ textHistory, lockedCategory });
    if (!skim) return { skipped: true };

    const category = lockedCategory || skim.category;
    const fields = mergeFields(category, priorChecklist, skim.fields);
    const language: LangKey = languageLocked || !skim.language ? priorLanguage : resolveLanguage(skim.language);
    return {
      provisional: true,
      messages: pendingMedia ? [{ kind: "text", body: skimReply({ category, fields, pendingMedia, language }) }] : [],
      category,
      categoryLabel: CATEGORIES[category].label,
      checklist: fields,
      checklistView: checklistView(category, fields, priorValues || {}, language),
      values: priorValues || {},
      summary: priorSummary,
      language,
    };
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
  const language: LangKey = languageLocked || !understood.language ? priorLanguage : resolveLanguage(understood.language);
  const { required, optional } = missingFields(category, fields, values);
  const ready = required.length === 0;
  const reply = nextReply({ category, fields, values, summary, retracted, language });

  return {
    messages: [{ kind: "buttons", body: reply, buttons: sendButtons(ready, language) }],
    category,
    categoryLabel: CATEGORIES[category].label,
    checklist: fields,
    checklistView: checklistView(category, fields, values, language),
    values,
    retracted,
    ready,
    language,
    missingOptionalCount: optional.length,
    summary,
    ...mapping(category, values, summary, false),
  };
}
