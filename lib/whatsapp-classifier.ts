// Niriksh's own native WhatsApp-style intake classifier — ported from Bhumika's
// umang-reimagined repo (lib/niriksh.js) per docs/whatsapp-demo.md. Deliberately isolated from
// lib/analyzer.ts's severity/routing engine: this module decides what to ASK the citizen next
// (a checklist gate), not how to route or score severity once a case exists.
//
// The checklist itself is a monotonic, caller-carried structure, not something re-derived
// fresh each turn: app/api/mock/whatsapp-chat/route.ts hands back `checklist` + `category`
// after every turn, the client echoes both back on the next request, and mergeFields() below
// ORs new reads onto what's already ticked — so a field confirmed on turn 1 can never
// silently un-tick itself just because turn 3's re-read of the conversation missed it.

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { LangKey, resolveLanguage, t } from "./whatsapp-i18n";

export type { LangKey };
export { resolveLanguage };

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash";
const RESERVE_MODEL = process.env.GEMINI_RESERVE_MODEL || "gemini-3.6-flash";
// The skim tier (analyzeSkim below): a Flash-Lite model reading TEXT ONLY, asked for nothing
// but category + which fields the words cover. Runs in PARALLEL with the full pass, never
// instead of it.
const SKIM_MODEL = process.env.WHATSAPP_DEMO_SKIM_MODEL || "gemini-3.5-flash-lite";

export type CategoryKey = "phishing_payment" | "threatening_messages" | "investment_deepfake" | "child_safety";

export interface FieldDef {
  key: string;
  label: string;
  required: boolean;
}

export interface CategoryDef {
  label: string;
  fields: FieldDef[];
}

export type Fields = Record<string, boolean>;
export type Values = Record<string, string>;

export interface MediaPart {
  mimeType: string;
  base64: string;
}

export interface ChecklistRow {
  key: string;
  label: string;
  required: boolean;
  done: boolean;
  deltaPct: number;
}

export interface AnalyzeResult {
  transcript: string;
  summary: string;
  category: CategoryKey;
  fields: Fields;
  values: Values;
  retract: string[];
  urgency: number;
  language: string;
}

export interface SkimResult {
  category: CategoryKey;
  fields: Fields;
  language: string;
}

// Two fields every case needs regardless of category — see lib/niriksh.js's original comment
// for the "why required" reasoning (jurisdiction can't be decided without state; urgency
// depends on whether the incident is still live).
const COMMON_FIELDS: FieldDef[] = [
  { key: "channel", label: "which app or platform this happened on", required: true },
  { key: "incident_status", label: "whether it's still going on or has stopped", required: true },
  { key: "state", label: "which State or UT you're in", required: true },
  { key: "district", label: "your district or city", required: false },
];

const CATEGORY_DEFS: Record<CategoryKey, CategoryDef> = {
  phishing_payment: {
    label: "Phishing & payment loss",
    fields: [
      { key: "utr", label: "the UTR / transaction reference", required: true },
      { key: "bank_account", label: "the bank or account involved", required: true },
      { key: "amount", label: "the amount lost", required: true },
      { key: "date", label: "when it happened", required: true },
      { key: "payment_app", label: "which payment app was used", required: false },
      { key: "suspect_contact", label: "the scammer's number, UPI ID, or profile, if known", required: false },
    ],
  },
  threatening_messages: {
    label: "Threatening messages",
    fields: [
      { key: "chat_evidence", label: "a screenshot or the text of the messages", required: true },
      { key: "sender_contact", label: "the sender's number or handle", required: true },
    ],
  },
  investment_deepfake: {
    label: "Investment deepfake",
    fields: [
      { key: "media_evidence", label: "the video or the link itself", required: true },
      { key: "money_destination", label: "where the money was sent", required: true },
      { key: "amount_lost", label: "how much money was lost", required: false },
    ],
  },
  child_safety: {
    label: "Child-safety risk",
    fields: [
      { key: "reporter_relationship", label: "your relationship to the child", required: true },
      { key: "suspect_identifier", label: "anything you know about who posted it (only if you're sure — don't guess)", required: false },
    ],
  },
};

export const CATEGORIES: Record<CategoryKey, CategoryDef> = Object.fromEntries(
  (Object.entries(CATEGORY_DEFS) as Array<[CategoryKey, CategoryDef]>).map(([key, def]) => [
    key,
    { ...def, fields: [...def.fields, ...COMMON_FIELDS] },
  ]),
) as Record<CategoryKey, CategoryDef>;

const CATEGORY_KEYS = Object.keys(CATEGORIES) as CategoryKey[];

function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === "string" && (CATEGORY_KEYS as string[]).includes(value);
}

// Every field this category's checklist tracks — required and nice-to-have — still false
// unless overridden.
export function blankFields(category: CategoryKey): Fields {
  const out: Fields = {};
  for (const f of CATEGORIES[category].fields) out[f.key] = false;
  return out;
}

// The monotonic OR-forward: once a field is true on the carried-forward checklist OR in
// this turn's fresh read, it stays true.
export function mergeFields(category: CategoryKey, prior: Fields | null | undefined, fresh: Fields | null | undefined): Fields {
  const merged = blankFields(category);
  for (const f of CATEGORIES[category].fields) {
    merged[f.key] = Boolean(prior?.[f.key]) || Boolean(fresh?.[f.key]);
  }
  return merged;
}

// Values merge differently from fields: a field only ever earns yes once (mergeFields), but a
// VALUE has to stay correctable — a non-empty fresh read replaces, and the prior is kept only
// where this turn read nothing.
export function mergeValues(category: CategoryKey, prior: Values | null | undefined, fresh: Values | null | undefined): Values {
  const merged: Values = {};
  for (const f of CATEGORIES[category].fields) {
    const next = fresh?.[f.key];
    const before = prior?.[f.key];
    if (typeof next === "string" && next.trim()) merged[f.key] = next.trim();
    else if (typeof before === "string" && before.trim()) merged[f.key] = before.trim();
  }
  return merged;
}

// Fields whose entire meaning IS the attachment/evidence itself.
const EVIDENCE_ONLY_FIELDS = new Set(["chat_evidence", "media_evidence"]);

function isFieldDone(key: string, fields: Fields | undefined, values: Values | undefined): boolean {
  if (!fields?.[key]) return false;
  if (EVIDENCE_ONLY_FIELDS.has(key)) return true;
  return Boolean(values?.[key]);
}

export function missingFields(category: CategoryKey, fields: Fields, values: Values) {
  const catFields = CATEGORIES[category].fields;
  return {
    required: catFields.filter(f => f.required && !isFieldDone(f.key, fields, values)).map(f => f.key),
    optional: catFields.filter(f => !f.required && !isFieldDone(f.key, fields, values)).map(f => f.key),
  };
}

// How many points each field contributes to case strength. THE single source of the split —
// the score, the per-row "+N%" labels, and checklistView() all read it.
const OPTIONAL_WEIGHT = 1;
const REQUIRED_WEIGHT = 2;

function fieldWeights(cat: CategoryDef): Record<string, number> {
  const units = cat.fields.reduce((s, f) => s + (f.required ? REQUIRED_WEIGHT : OPTIONAL_WEIGHT), 0);
  const out: Record<string, number> = {};
  for (const f of cat.fields) {
    out[f.key] = units ? ((f.required ? REQUIRED_WEIGHT : OPTIONAL_WEIGHT) / units) * 100 : 0;
  }
  return out;
}

// Ordered, label-carrying view of the checklist — what the UI renders tick marks from (both
// the chat bubble's own checklistBlock() and the sidebar tray in WhatsAppDemo.tsx).
export function checklistView(category: CategoryKey, fields: Fields, values: Values, language: LangKey = "en"): ChecklistRow[] {
  const cat = CATEGORIES[category];
  const w = fieldWeights(cat);
  return cat.fields.map(f => ({
    key: f.key,
    label: fieldLabel(f.key, language),
    required: f.required,
    done: isFieldDone(f.key, fields, values),
    deltaPct: Math.round(w[f.key]),
  }));
}

// Case strength is a COMPLETENESS score, not a claimed odds-of-recovery percentage.
function caseStrength(cat: CategoryDef, fields: Fields, values: Values): number {
  const w = fieldWeights(cat);
  const total = cat.fields
    .filter(f => isFieldDone(f.key, fields, values))
    .reduce((sum, f) => sum + w[f.key], 0);
  return Math.round(total);
}

function categoryPromptBlock(lockedCategory: CategoryKey | null) {
  if (lockedCategory) {
    return `- "category": always "${lockedCategory}" — this case has already been classified, do not change it.`;
  }
  return `- "category": the closest match, one of:
    - "phishing_payment": a fraudulent transaction, UPI scam, phishing link that led to a
      payment, or a bank account getting frozen/flagged.
    - "threatening_messages": threats, harassment, or extortion attempts over chat/SMS/call.
    - "investment_deepfake": a fake/AI-generated video or ad (often of a public figure)
      promoting an investment or scheme that led to a loss.
    - "child_safety": synthetic, manipulated, or otherwise concerning media involving a child.
  Pick the single closest match — never invent a fifth category.`;
}

function fieldsPromptBlock(lockedCategory: CategoryKey | null) {
  if (lockedCategory) {
    const keys = CATEGORIES[lockedCategory].fields.map(f => `"${f.key}"`).join(", ");
    return `  Extract these: ${keys}.`;
  }
  return CATEGORY_KEYS.map(
    c => `  - if category is "${c}": ${CATEGORIES[c].fields.map(f => `"${f.key}"`).join(", ")}`,
  ).join("\n");
}

const COMMON_FIELD_RULES = `  Two keys apply to every category and have their own traps:
  - "channel": the app or platform where the INCIDENT happened. Set it true only when the
    citizen says where the scam/threat/content actually reached them ("link came on Telegram",
    "he called me", "the reel was on Instagram"). Its value must be one of: Instagram,
    Facebook, WhatsApp, Telegram, YouTube, X/Twitter, Email, SMS, Phone call, Website, Other.
  - "incident_status": whether it's still going on. Infer it whenever the citizen's own words
    settle it. Its value must be one of: Ongoing, Still available or happening, Stopped or
    removed, Not sure.
  - "state" / "district": where the REPORTER is, which is what decides jurisdiction — not
    where a website or company is based. Tick them only from what the citizen actually says.
    Values must be full names ("Karnataka", not "KA").`;

const FIELD_TICK_RULES = `  Two keys are mis-ticked often enough to call out explicitly:
  - "payment_app": UPI is the payment RAIL, not an app. Set it true only when a specific app
    is named: Google Pay/GPay, PhonePe, Paytm, BHIM, Amazon Pay, WhatsApp Pay, Cred, MobiKwik,
    Freecharge, Jio Pay, Navi, super.money, Airtel Payments Bank, YONO (SBI), or any other
    clearly-named payment app.
  - "bank_account": set it true only when a specific bank is NAMED, or a specific
    account/UPI identifier is given. Generic phrasing ("my bank account") is NOT enough.`;

// "chat_evidence"/"media_evidence" are the two fields whose entire meaning IS the attachment
// (see EVIDENCE_ONLY_FIELDS below) -- a bare tick with no value is expected and fine for them.
// But that same "no value needed" property is exactly what makes them easy to mis-tick from a
// citizen's INTENT rather than an actual attachment/quote, so this gets called out on its own
// rather than folded into the general "do not invent details" instruction above, which wasn't
// enough on its own in testing.
const EVIDENCE_TICK_RULES = `  "chat_evidence" and "media_evidence" are ticked ONLY by evidence actually present in this
  conversation already -- an attached screenshot/video/document, or the literal message text
  or link quoted in the citizen's own words. A promise to send it later ("I'll share the
  screenshot", "I will send the video soon", "I have it, will forward it") is NOT evidence yet
  -- leave the field false until something is actually here, even if the citizen sounds certain
  they will send it.`;

function fieldTickRules(lockedCategory: CategoryKey | null) {
  const payment = !lockedCategory || lockedCategory === "phishing_payment" ? `\n${FIELD_TICK_RULES}` : "";
  const evidence = !lockedCategory || lockedCategory === "threatening_messages" || lockedCategory === "investment_deepfake"
    ? `\n${EVIDENCE_TICK_RULES}` : "";
  return `${payment}${evidence}\n${COMMON_FIELD_RULES}`;
}

function buildPrompt(lockedCategory: CategoryKey | null) {
  return `You are the intake engine for Niriksh, a cybercrime/fraud evidence-review service in
India. Read the citizen's message (it may be audio, an image, a document, or text, in any
Indian language) and return ONLY a JSON object with these keys:
- "transcript": if the message is audio, the speech transcribed verbatim in its original
  language and script (not translated). Leave "" for non-audio input.
- "summary": a one or two sentence summary IN ENGLISH of what happened.
${categoryPromptBlock(lockedCategory)}
- "fields": an object. Only include keys belonging to the category (see below). Set true
  only if that specific detail is ACTUALLY present in the message, otherwise false. Do not
  invent details.
${fieldsPromptBlock(lockedCategory)}${fieldTickRules(lockedCategory)}
- "values": an object mapping each field key you set to true to the ACTUAL detail you read,
  as a short plain string. Quote only what's literally there; never guess, paraphrase, or
  fill a gap. Use "" when the field is genuinely true but has no quotable value.
- "retract": an array of field keys that the citizen is EXPLICITLY asking you to remove,
  undo, or forget. Leave "" (empty array) on almost every turn — this is rare.
- "urgency": integer 0-25 — how time-critical this case is.
- "language": the human language AND script the citizen used in THIS message (audio or text),
  e.g. "Hindi (Devanagari)", "Hindi (Hinglish / Latin script)", "Kannada", "Marathi", "Tamil",
  "English". Match their script exactly — if they typed Hindi in Latin letters, report the
  Hinglish/Latin variant, don't assume Devanagari. Default to "English" only if genuinely
  ambiguous or mixed with no clear dominant language.`;
}

function buildSkimPrompt(lockedCategory: CategoryKey | null) {
  return `You are the fast first-pass intake skimmer for Niriksh, an Indian cybercrime/fraud
evidence-review service. Read ONLY the citizen's words below and return ONLY a JSON object.
Be fast and literal — do not infer, do not summarize, do not explain.
${categoryPromptBlock(lockedCategory)}
- "fields": an object. Set a key true only if the citizen's words ACTUALLY state that detail,
  otherwise false. Media the citizen sent is NOT included here and is being read separately.
${fieldsPromptBlock(lockedCategory)}${fieldTickRules(lockedCategory)}
- "language": the human language AND script of the citizen's words below, e.g.
  "Hindi (Devanagari)", "Hindi (Hinglish / Latin script)", "Kannada", "English". Best-effort
  from these words alone; default to "English" if there's nothing to go on.`;
}

interface RawAnalyze {
  transcript?: unknown;
  summary?: unknown;
  category?: unknown;
  fields?: Record<string, unknown>;
  values?: Record<string, unknown>;
  retract?: unknown;
  urgency?: unknown;
  language?: unknown;
}

function normalizeLanguage(value: unknown): string {
  const s = typeof value === "string" ? value.trim().slice(0, 60) : "";
  return s || "English";
}

function normalize(obj: RawAnalyze | null | undefined, fallbackCategory: CategoryKey): AnalyzeResult {
  const category = isCategoryKey(obj?.category) ? obj.category : fallbackCategory;
  const fields = blankFields(category);
  for (const f of CATEGORIES[category].fields) fields[f.key] = Boolean(obj?.fields?.[f.key]);

  const values: Values = {};
  for (const f of CATEGORIES[category].fields) {
    if (!fields[f.key]) continue;
    const v = obj?.values?.[f.key];
    if (typeof v === "string" && v.trim()) values[f.key] = v.trim().slice(0, 120);
  }

  const validKeys = new Set(CATEGORIES[category].fields.map(f => f.key));
  const retract = Array.isArray(obj?.retract) ? (obj.retract as unknown[]).filter((k): k is string => typeof k === "string" && validKeys.has(k)) : [];

  const urgency = Number(obj?.urgency);
  return {
    transcript: (typeof obj?.transcript === "string" ? obj.transcript : "").trim(),
    summary: (typeof obj?.summary === "string" ? obj.summary : "").trim(),
    category,
    fields,
    values,
    retract,
    urgency: Number.isFinite(urgency) ? Math.max(0, Math.min(25, Math.round(urgency))) : 10,
    language: normalizeLanguage(obj?.language),
  };
}

type GenAiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

function buildParts(textHistory: string[], media: MediaPart[], lockedCategory: CategoryKey | null): GenAiPart[] {
  const parts: GenAiPart[] = [{ text: buildPrompt(lockedCategory) }];
  const lines = textHistory.filter(Boolean);
  if (lines.length) {
    const body = lines.length === 1 ? lines[0] : lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
    parts.push({ text: `Conversation so far, in order:\n${body}` });
  }
  for (const m of media) {
    parts.push({ inlineData: { mimeType: m.mimeType, data: m.base64 } });
  }
  return parts;
}

function providerMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}

function isTemporaryFailure(error: unknown): boolean {
  return /high demand|overload|temporar|unavailable|timeout|timed out|deadline|aborted|resource_exhausted|network|fetch failed|econnreset|socket|408|429|500|502|503|504/i.test(providerMessage(error));
}

interface AnalyzeArgs {
  textHistory?: string[];
  media?: MediaPart[];
  lockedCategory?: CategoryKey | null;
}

// `lockedCategory`, once a case has been classified on turn 1, is passed back in on every
// later turn so Gemini re-reads the full conversation for this turn's field values without
// ever being able to flip the category underneath an already-started checklist.
export async function analyzeFull({ textHistory = [], media = [], lockedCategory = null }: AnalyzeArgs): Promise<AnalyzeResult> {
  if (!API_KEY) return fixtureAnalyze(textHistory, media, lockedCategory);

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const parts = buildParts(textHistory, media, lockedCategory);
  const models = [MODEL, FALLBACK_MODEL, RESERVE_MODEL].filter((m, i, arr) => arr.indexOf(m) === i);
  // Same shrinking per-attempt budget as app/api/analyze/route.ts's generateStructuredAnalysis
  // -- each retry gets less time than the last, so the worst case (every model times out) still
  // finishes well inside the Python backend's 90s call_turn_engine timeout.
  const timeouts = [25_000, 18_000, 10_000];

  for (let i = 0; i < models.length; i += 1) {
    const model = models[i];
    const timeout = timeouts[i] ?? 10_000;
    // No configured model here is ever "gemini-2.5-*" (production only sets 3.x), but this
    // mirrors analyze/route.ts's provider-config exactly rather than assuming that stays true.
    // Without this, a gemini-3.x call runs with Gemini's uncontrolled default thinking budget --
    // confirmed live: a trivial one-word prompt still spent 26 tokens "thinking" -- which is
    // most of why real (structured, multimodal) turns were taking long enough to trip the old
    // 30s outer timeout even with a valid key and working network.
    const thinkingConfig = model.startsWith("gemini-2.5-") ? { thinkingBudget: 0 } : { thinkingLevel: ThinkingLevel.LOW };
    try {
      const res = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json",
          temperature: 0,
          thinkingConfig,
          httpOptions: { timeout },
          abortSignal: AbortSignal.timeout(timeout),
        },
      });
      const raw = JSON.parse(res.text || "{}") as RawAnalyze;
      return normalize(raw, lockedCategory || "phishing_payment");
    } catch (err) {
      const temporary = isTemporaryFailure(err);
      console.error(`[whatsapp-classifier] ${model} failed${temporary ? " (temporary, trying next model)" : " (non-temporary, not retrying)"}:`, providerMessage(err));
      if (!temporary) break;
    }
  }
  console.error("[whatsapp-classifier] no model available, using fixture");
  return fixtureAnalyze(textHistory, media, lockedCategory);
}

// The fast tier. Reads ONLY the words the citizen has typed/sent so far — answers the one
// question the citizen sees answered instantly: which checklist items do these words already
// cover? Never the only pass: whatever it returns is OR'd into the full pass's read.
export async function analyzeSkim({ textHistory = [], lockedCategory = null }: { textHistory?: string[]; lockedCategory?: CategoryKey | null }): Promise<SkimResult | null> {
  const lines = textHistory.filter(Boolean);
  if (!lines.length) return null;
  if (!API_KEY) {
    const { category, fields } = fixtureAnalyze(textHistory, [], lockedCategory);
    return { category, fields, language: "English" };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const timeout = 15_000;
    const thinkingConfig = SKIM_MODEL.startsWith("gemini-2.5-") ? { thinkingBudget: 0 } : { thinkingLevel: ThinkingLevel.LOW };
    const res = await ai.models.generateContent({
      model: SKIM_MODEL,
      contents: [{
        role: "user",
        parts: [
          { text: buildSkimPrompt(lockedCategory) },
          { text: `Conversation so far, in order:\n${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}` },
        ],
      }],
      config: {
        responseMimeType: "application/json",
        temperature: 0,
        thinkingConfig,
        httpOptions: { timeout },
        abortSignal: AbortSignal.timeout(timeout),
      },
    });
    const raw = JSON.parse(res.text || "{}") as { category?: unknown; fields?: Record<string, unknown>; language?: unknown };
    const category = lockedCategory || (isCategoryKey(raw.category) ? raw.category : "phishing_payment");
    const fields = blankFields(category);
    for (const f of CATEGORIES[category].fields) fields[f.key] = Boolean(raw.fields?.[f.key]);
    return { category, fields, language: normalizeLanguage(raw.language) };
  } catch (err) {
    console.error(`[whatsapp-classifier] skim (${SKIM_MODEL}) failed, full pass will cover it:`, providerMessage(err));
    return null;
  }
}

// --- Fixture mode (no API key): rough keyword routing so the flow is demoable offline. ---

const PAYMENT_APPS = [
  "google pay", "gpay", "g pay", "phonepe", "phone pe", "paytm", "bhim", "amazon pay",
  "whatsapp pay", "cred", "mobikwik", "freecharge", "jio pay", "navi", "super.money",
  "airtel payments bank", "yono",
];

const BANK_NAMES = [
  "state bank of india", "sbi", "hdfc bank", "hdfc", "icici bank", "icici", "axis bank",
  "kotak mahindra bank", "kotak", "punjab national bank", "pnb", "bank of baroda",
  "canara bank", "union bank of india", "indusind bank",
];

const ACCOUNT_ID_RE = /\b\d{9,16}\b|\ba\/c\b|\baccount (?:number|no\.?)\b|\b[a-z0-9._-]+@[a-z]{2,}\b(?!\.)/i;

function fixtureAnalyze(textHistory: string[], media: MediaPart[], lockedCategory: CategoryKey | null): AnalyzeResult {
  const text = textHistory.filter(Boolean).join(" ");
  const t = text.toLowerCase();
  const has = (...words: string[]) => words.some(w => t.includes(w));

  let category: CategoryKey | null = lockedCategory;
  if (!category) {
    category = "phishing_payment";
    if (has("threat", "threaten", "scared", "harass", "extort")) category = "threatening_messages";
    else if (has("deepfake", "invest", "guaranteed return", "scheme", "trading app")) category = "investment_deepfake";
    else if (has("child", "minor", "kid")) category = "child_safety";
    else if (has("utr", "upi", "frozen", "bank", "transaction", "phishing", "fraud")) category = "phishing_payment";
  }
  const resolvedCategory: CategoryKey = category;

  const fields = blankFields(resolvedCategory);
  if (/\b[a-z0-9]{6,23}\b/i.test(t) && has("utr")) fields.utr = true;
  if (has(...BANK_NAMES) || ACCOUNT_ID_RE.test(t)) fields.bank_account = true;
  if (/[₹$]\s?\d|\b\d+\s?(rs|rupees|inr)\b/.test(t)) fields.amount = true;
  if (has("today", "yesterday", "last night", "ago", "on ")) fields.date = true;
  if (has(...PAYMENT_APPS)) fields.payment_app = true;
  if (media.length) { fields.chat_evidence = true; fields.media_evidence = true; }
  if (/\b\d{10}\b/.test(t) || has("number", "handle", "@")) { fields.sender_contact = true; fields.suspect_contact = true; }
  if (has("sent to", "transferred to", "paid to")) fields.money_destination = true;
  if (has("still up", "still online", "removed", "taken down", "not sure")) fields.incident_status = true;
  if (has("parent", "guardian", "my child", "my son", "my daughter", "myself")) fields.reporter_relationship = true;
  if (has("whatsapp", "instagram", "facebook", "telegram", "youtube")) fields.channel = true;
  if (has("still messaging", "keeps messaging", "still sending")) fields.incident_status = true;

  const retract: string[] = [];
  if (has("remove", "forget", "ignore that", "delete that", "that's wrong", "was wrong")) {
    if (has("utr", "transaction reference")) retract.push("utr");
    if (has("bank", "account")) retract.push("bank_account");
    if (has("amount")) retract.push("amount");
    if (has("date", "when")) retract.push("date");
    if (has("chat", "screenshot", "message")) retract.push("chat_evidence");
    if (has("number", "handle", "contact")) retract.push("sender_contact", "suspect_contact");
    if (has("video", "link")) retract.push("media_evidence");
    if (has("sent to", "transferred to", "destination")) retract.push("money_destination");
  }

  return normalize({
    summary: text ? text.slice(0, 140) : "Case received (media only).",
    category: resolvedCategory,
    fields,
    retract,
    urgency: 12,
  }, resolvedCategory);
}

// Every field/category label the citizen sees is looked up per-language here rather than from
// FieldDef.label/CategoryDef.label directly — those English strings remain the internal/prompt
// vocabulary (used to build the Gemini prompt and to key CATEGORIES), while fieldLabel/
// categoryLabel are what actually renders in the chat bubble.
function fieldLabel(key: string, lang: LangKey): string {
  return t(`field_${key}`, lang);
}

function categoryLabel(category: CategoryKey, lang: LangKey): string {
  return t(`cat_${category}`, lang);
}

// Renders the checklist AS the citizen sees it — this goes straight into the chat bubble.
function checklistRow(f: FieldDef, fields: Fields, values: Values, deltaPct: number, lang: LangKey): string {
  const label = fieldLabel(f.key, lang);
  if (!isFieldDone(f.key, fields, values)) {
    return deltaPct ? `⬜ ${label} _(+${deltaPct}%)_` : `⬜ ${label}`;
  }
  const val = values?.[f.key];
  return val ? `✅ ${label} — *${val}*` : `✅ ${label}`;
}

function checklistBlock(cat: CategoryDef, fields: Fields, values: Values, lang: LangKey): string {
  const w = fieldWeights(cat);
  const rows = (required: boolean) => cat.fields
    .filter(f => Boolean(f.required) === required)
    .map(f => checklistRow(f, fields, values, Math.round(w[f.key]), lang))
    .join("\n");

  const sections = [`${t("required_header", lang)}\n${rows(true)}`];
  if (cat.fields.some(f => !f.required)) {
    sections.push(`${t("optional_header", lang)}\n${rows(false)}`);
  }
  return sections.join("\n\n");
}

// Legal/regulatory citations (RBI circular year, IT Rules year, day counts) are embedded as
// literal tokens inside each language's timeline_* template — see lib/whatsapp-i18n.ts.
const TIMELINE_KEY: Record<CategoryKey, string> = {
  phishing_payment: "timeline_phishing_payment",
  investment_deepfake: "timeline_investment_deepfake",
  threatening_messages: "timeline_threatening_messages",
  child_safety: "timeline_child_safety",
};

function strengthBlock(category: CategoryKey, fields: Fields, values: Values, ready: boolean, lang: LangKey): string {
  const pct = caseStrength(CATEGORIES[category], fields, values);
  const bandKey = pct < 30 ? "band_needs_detail" : pct < 40 ? "band_close" : "band_passing";
  const timeline = ready ? t(TIMELINE_KEY[category], lang) : t("not_ready_yet", lang);
  return `${t("strength_line", lang, { pct: String(pct), band: t(bandKey, lang) })}\n${timeline}`;
}

const AFFIRMATIVE = /\b(yes|yeah|yep|yup|ok|okay|okey|sure|correct|right|confirm(ed)?|send( it)?|submit|go ahead|proceed|haan|han|haa|ji|theek|thik|sahi|bilkul|bhej|bhejo|bhej do|kar do|done)\b/i;
const DISQUALIFIER = /\b(no|not|nope|nahi|nahin|na|but|however|actually|wait|hold|wrong|incorrect|galat|change|correct it|fix|edit|update|remove|forget|instead|isn'?t|aren'?t|mistake)\b/i;

export function detectConfirmation(text: string | null | undefined): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (t.split(/\s+/).length > 6) return false;
  if (DISQUALIFIER.test(t)) return false;
  return AFFIRMATIVE.test(t);
}

function listOut(items: string[], lang: LangKey): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ${t("list_and", lang)} ${items[items.length - 1]}`;
}

export interface NextReplyArgs {
  category: CategoryKey;
  fields: Fields;
  values: Values;
  summary: string;
  retracted?: string[];
  language: LangKey;
}

export function nextReply({ category, fields, values, summary, retracted = [], language }: NextReplyArgs): string {
  const cat = CATEGORIES[category];
  const { required, optional } = missingFields(category, fields, values);
  const ready = required.length === 0;
  const strength = strengthBlock(category, fields, values, ready, language);
  const block = checklistBlock(cat, fields, values, language);
  const correctionHint = t("correction_hint", language);

  const retractedLabels = retracted.filter(k => cat.fields.some(f => f.key === k)).map(k => fieldLabel(k, language));
  const retractedLine = retractedLabels.length
    ? `${t("retracted_line", language, { fields: listOut(retractedLabels, language) })}\n\n`
    : "";

  if (required.length) {
    const nextLabel = fieldLabel(required[0], language);
    const ask = t("ask_next", language, { category: categoryLabel(category, language), field: nextLabel });
    return `${strength}\n\n${retractedLine}${ask}\n\n${block}\n\n${correctionHint}`;
  }

  const cleanSummary = (summary || "").replace(/\.+$/, "");
  const thanks = cleanSummary
    ? t("ready_thanks_summary", language, { category: categoryLabel(category, language), summary: cleanSummary })
    : t("ready_thanks_plain", language, { category: categoryLabel(category, language) });
  const base = `${retractedLine}${thanks}`;
  const tail = optional.length
    ? t("optional_tail", language, { field: fieldLabel(optional[0], language) })
    : "";
  return `${strength}\n\n${base}\n\n${block}\n\n${t("send_prompt", language)}${tail} ${correctionHint}`;
}

export interface ChatButton {
  id: "send_now" | "dont_send";
  title: string;
  disabled?: boolean;
}

export function sendButtons(ready: boolean, language: LangKey): ChatButton[] {
  return [
    { id: "send_now", title: t("btn_send_now", language), disabled: !ready },
    { id: "dont_send", title: t("btn_dont_send", language) },
  ];
}

export function skimReply({ category, fields, pendingMedia, language }: { category: CategoryKey; fields: Fields; pendingMedia: string | null; language: LangKey }): string {
  const cat = CATEGORIES[category];
  const ticked = cat.fields.filter(f => fields[f.key]);
  const waitingKey = ({
    audio: "waiting_audio",
    image: "waiting_image",
    video: "waiting_video",
    document: "waiting_document",
  } as Record<string, string>)[pendingMedia || ""] || "waiting_default";
  const waiting = t(waitingKey, language);

  const got = ticked.length
    ? t("got_fields", language, { fields: listOut(ticked.map(f => fieldLabel(f.key, language)), language) })
    : t("got_message", language);
  return `${got} ${t("skim_tail", language, { waiting })}`;
}
