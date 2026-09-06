import type { GroundedFact, TriageCase } from "./types";

export interface DisplayIndicator {
  type: "Phone" | "Email" | "UPI ID" | "Transaction ID / UTR" | "URL" | "Domain" | "Social handle" | "Bank / account identifier";
  value: string;
  source: string;
}

const DISPLAY_TYPES: Record<string, DisplayIndicator["type"]> = {
  phone: "Phone",
  email: "Email",
  "upi id": "UPI ID",
  "transaction id": "Transaction ID / UTR",
  "transaction id / utr": "Transaction ID / UTR",
  url: "URL",
  domain: "Domain",
  username: "Social handle",
  "social handle": "Social handle",
  "bank account": "Bank / account identifier",
};

function factSource(facts: GroundedFact[], type: string, value: string) {
  const comparable = value.trim().toLocaleLowerCase();
  return facts.find(fact => fact.value.trim().toLocaleLowerCase() === comparable && (
    fact.label.toLocaleLowerCase() === type.toLocaleLowerCase()
    || fact.label.toLocaleLowerCase().includes(type.toLocaleLowerCase())
  ))?.source
    || facts.find(fact => fact.value.trim().toLocaleLowerCase() === comparable)?.source
    || "Complaint record";
}

function classifyReportedAccount(value: string): DisplayIndicator["type"] | undefined {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return "URL";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Email";
  if (/^[\w.-]{2,256}@[a-z]{2,64}$/i.test(trimmed)) return "UPI ID";
  if (/^@?[a-z0-9._]{3,30}$/i.test(trimmed)) return "Social handle";
  if (/^(?:\+?91[\s-]?)?[6-9]\d{9}$/.test(trimmed.replace(/[()]/g, ""))) return "Phone";
  return undefined;
}

export function caseIndicators(item: TriageCase): DisplayIndicator[] {
  const facts = item.analysisDetails?.facts || [];
  const seen = new Set<string>();
  const indicators: DisplayIndicator[] = [];

  for (const entity of item.entities) {
    const key = entity.type.trim().toLocaleLowerCase();
    const type = DISPLAY_TYPES[key] || (key === "reported account" ? classifyReportedAccount(entity.value) : undefined);
    if (!type) continue;
    const value = entity.value.trim();
    const identity = `${type}:${value.toLocaleLowerCase()}`;
    if (!value || seen.has(identity)) continue;
    seen.add(identity);
    indicators.push({ type, value, source: factSource(facts, entity.type, value) });

    if (type === "URL") {
      try {
        const domain = new URL(value).hostname.toLocaleLowerCase().replace(/\.$/, "");
        const domainKey = `Domain:${domain}`;
        if (domain && !seen.has(domainKey)) {
          seen.add(domainKey);
          indicators.push({ type: "Domain", value: domain, source: factSource(facts, entity.type, value) });
        }
      } catch { /* Preserve the submitted URL without guessing at an invalid hostname. */ }
    }
  }
  return indicators;
}

const WHY_IT_MATTERS: Array<[RegExp, string]> = [
  [/profile|account|username|contact detail/i, "Helps locate the exact account or contact described in the complaint."],
  [/url|link|source/i, "Preserves the precise online location for verification and platform follow-up."],
  [/date|time/i, "Helps reconstruct chronology and request time-bounded records."],
  [/transaction id|utr/i, "Allows a reviewer or financial institution to identify the reported transfer."],
  [/bank|wallet|merchant/i, "Identifies the payment service or institution relevant to the report."],
  [/amount/i, "Clarifies the reported financial impact without changing case priority."],
  [/screenshot|file|evidence|media/i, "Provides material a reviewer can compare with the narrative."],
  [/state|district|police station|jurisdiction/i, "Supports a human jurisdiction and destination decision."],
  [/still happening|ongoing/i, "Clarifies whether the reported activity remains active."],
];

export function missingInformation(item: string) {
  return WHY_IT_MATTERS.find(([pattern]) => pattern.test(item))?.[1]
    || "Adds context that may help a reviewer verify and act on the complaint.";
}

export function sourceEvidenceName(source: string) {
  return source.match(/^Evidence:\s*(.+)$/i)?.[1]?.trim();
}

export function evidenceAnchor(name: string) {
  return `evidence-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
