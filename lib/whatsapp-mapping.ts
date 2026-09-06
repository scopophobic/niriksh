// Translates the WhatsApp-style chat's checklist into niriksh's own ComplaintDetails shape —
// the same structure ReportFlow.tsx's guided form builds. Kept separate from
// lib/whatsapp-classifier.ts on purpose: that module decides what to ASK the citizen next,
// this one decides what a finished checklist actually MEANS as a complaint. There is no
// external contract here (no Bhumika/niriksh HTTP handoff, per ADR-046) — this chat lives
// natively inside niriksh and feeds straight into lib/analyzer.ts + useCaseStore().addCase,
// exactly like ReportFlow.tsx does.

import { CATEGORIES, CategoryKey, Values } from "./whatsapp-classifier";
import { ComplaintDetails } from "./types";

// niriksh's own channel enum (matches ReportFlow.tsx's CHANNELS dropdown, so a case filed
// through the chat looks identical to one filed through the guided form).
export const CHANNELS = [
  "Instagram", "Facebook", "WhatsApp", "Telegram", "YouTube", "X / Twitter",
  "Email", "SMS", "Phone call", "Website", "Other",
];

export const INCIDENT_STATUSES = ["Still available or happening", "Stopped or removed", "Not sure"] as const;

// Stable IDs from backend/app/modules/review/categories.json. The reporter chooses a subject
// folder through the chat scenario; Niriksh resolves the display label and review team.
const CATEGORY_IDS: Record<CategoryKey, string> = {
  phishing_payment: "financial",
  threatening_messages: "harassment",
  investment_deepfake: "social",
  child_safety: "sensitive",
};

// "42,000 rupees" / "₹42000" / "Rs. 42k" → "42000". Returns undefined rather than a guess
// when there's no number to read.
export function parseAmount(raw: string | undefined): string | undefined {
  const s = (raw || "").toLowerCase().replace(/[,\s]/g, "");
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return undefined;
  let n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (/lakh|lac/.test(s)) n *= 100000;
  else if (/crore/.test(s)) n *= 10000000;
  else if (/\dk\b/.test(s)) n *= 1000;
  return String(Math.round(n));
}

// "yesterday" / "3 September" / "2026-09-04" → YYYY-MM-DD, resolved against `today`.
export function normalizeDate(raw: string | undefined, today: Date = new Date()): string | undefined {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return undefined;

  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  const day = 86400000;
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (/\btoday\b|\baaj\b/.test(s)) return fmt(today);
  if (/\byesterday\b|\bkal\b/.test(s)) return fmt(new Date(today.getTime() - day));
  const ago = s.match(/(\d+)\s*days?\s*ago/);
  if (ago) return fmt(new Date(today.getTime() - Number(ago[1]) * day));

  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const monthIdx = months.findIndex(m => s.includes(m.slice(0, 3)));
  if (monthIdx >= 0) {
    const dayMatch = s.match(/\b(\d{1,2})\b/);
    const yearMatch = s.match(/\b(20\d{2})\b/);
    if (dayMatch) {
      const year = yearMatch ? Number(yearMatch[1]) : today.getUTCFullYear();
      const d = new Date(Date.UTC(year, monthIdx, Number(dayMatch[1])));
      if (!Number.isNaN(d.getTime())) return fmt(d);
    }
  }
  return undefined;
}

export function normalizeChannel(raw: string | undefined): string | undefined {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return undefined;
  const hit = CHANNELS.find(c => c.toLowerCase() === s);
  if (hit) return hit;
  if (/insta/.test(s)) return "Instagram";
  if (/fb|facebook/.test(s)) return "Facebook";
  if (/whats?app|wa\b/.test(s)) return "WhatsApp";
  if (/telegram|tg\b/.test(s)) return "Telegram";
  if (/youtube|yt\b/.test(s)) return "YouTube";
  if (/twitter|x\.com|\bx\b/.test(s)) return "X / Twitter";
  if (/mail/.test(s)) return "Email";
  if (/sms|text message/.test(s)) return "SMS";
  if (/call|phone/.test(s)) return "Phone call";
  if (/site|web|url|link/.test(s)) return "Website";
  return "Other";
}

export function normalizeIncidentStatus(raw: string | undefined): ComplaintDetails["incidentStatus"] {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return undefined;
  if (/still (available|online|up|live|happening|coming|messaging)|ongoing|continu/.test(s)) return "Still available or happening";
  if (/stopped|removed|taken down|deleted|blocked/.test(s)) return "Stopped or removed";
  return "Not sure";
}

export interface ToComplaintDetailsArgs {
  category: CategoryKey;
  values?: Values;
  confirmed?: boolean;
  today?: Date;
}

// Builds the ComplaintDetails object ReportFlow.tsx's own analyzeComplaint()/addCase() flow
// already expects — no separate contract shape to keep in sync with.
export function checklistToComplaintDetails({ category, values = {}, confirmed = false, today = new Date() }: ToComplaintDetailsArgs): ComplaintDetails {
  const details: ComplaintDetails = {
    selectedCategory: CATEGORY_IDS[category],
    declarationConfirmed: Boolean(confirmed),
  };

  const incidentDate = normalizeDate(values.date, today);
  if (incidentDate) details.incidentDate = incidentDate;

  const channel = normalizeChannel(values.channel);
  if (channel) details.channel = channel;

  const incidentStatus = normalizeIncidentStatus(values.incident_status);
  if (incidentStatus) details.incidentStatus = incidentStatus;

  if (values.state) details.state = values.state;
  if (values.district) details.district = values.district;

  const accountOrUrl = values.suspect_contact || values.sender_contact || values.media_evidence;
  if (accountOrUrl) details.accountOrUrl = accountOrUrl;

  // --- financial: the phishing/payment case's real payload ---
  const amount = parseAmount(values.amount ?? values.amount_lost);
  const utr = (values.utr || "").trim();
  const bank = values.bank_account || values.money_destination;
  if (amount || utr || bank) {
    details.financial = { involved: true, moneyStatus: "Transferred or debited" };
    if (bank) details.financial.bankOrWallet = bank;
    if (amount) details.financial.amount = amount;
    if (utr) details.financial.transactionId = utr;
    const txDate = normalizeDate(values.date, today);
    if (txDate) details.financial.transactionDate = txDate;
  }

  // --- aiMisuse: deepfake / synthetic-media cases ---
  if (category === "investment_deepfake" || category === "child_safety") {
    const distribution = normalizeIncidentStatus(values.incident_status);
    details.aiMisuse = {
      suspected: true,
      permission: "No permission",
      distribution: distribution === "Stopped or removed" ? "Removed or stopped" : "Still online or spreading",
    };
    if (values.media_evidence) details.aiMisuse.contentUrl = values.media_evidence;
    if (category === "child_safety") {
      details.aiMisuse.takedownWanted = true;
      details.reporterRole = "Parent or guardian";
    }
  }

  // --- suspect: only what the citizen actually reported, never inferred ---
  const suspect: NonNullable<ComplaintDetails["suspect"]> = {};
  const contact = values.suspect_contact || values.sender_contact;
  if (contact) {
    if (/@[a-z]/i.test(contact) && contact.includes(".")) suspect.email = contact;
    else if (/^\+?\d[\d\s-]{7,}$/.test(contact)) suspect.phone = contact;
    else if (/^https?:\/\//i.test(contact)) suspect.profileOrWebsite = contact;
    else suspect.nameOrAlias = contact;
  }
  if (values.money_destination) suspect.bankAccount = values.money_destination;
  if (Object.keys(suspect).length) details.suspect = suspect;

  return details;
}

// The narrative both lib/analyzer.ts and a human reviewer read. Composes the model's summary
// with the collected checklist values, so anything without a structured ComplaintDetails home
// (an odd detail the citizen volunteered) still reaches the narrative text.
export function buildNarrative({ category, values = {}, summary = "" }: { category: CategoryKey; values?: Values; summary?: string }): string {
  const cat = CATEGORIES[category];
  const lines: string[] = [];

  const head = (summary || "").trim();
  if (head) lines.push(head);

  const collected = cat.fields.filter(f => values[f.key]).map(f => `- ${f.label}: ${values[f.key]}`);
  if (collected.length) lines.push("", "Details the reporter gave:", ...collected);

  let text = lines.join("\n").trim();
  if (text.length < 40) {
    text = `${text} ${cat.label} reported through Niriksh's guided WhatsApp-style chat. The reporter's message did not include much further written detail.`.trim();
  }
  return text;
}
