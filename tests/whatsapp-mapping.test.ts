// Checks the /whatsapp checklist → ComplaintDetails mapping — ported from Bhumika's
// umang-reimagined repo (tests/niriksh-map.test.js), adapted to niriksh's own ComplaintDetails
// shape (lib/types.ts) instead of an external JSON contract, since this chat has no HTTP
// handoff — it feeds lib/analyzer.ts + useCaseStore().addCase directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseAmount, normalizeDate, normalizeChannel, normalizeIncidentStatus,
  checklistToComplaintDetails, buildNarrative, CHANNELS,
} from "../lib/whatsapp-mapping";

test("parseAmount reads the shapes citizens actually type", () => {
  assert.equal(parseAmount("42000 rupees"), "42000");
  assert.equal(parseAmount("₹42,000"), "42000");
  assert.equal(parseAmount("Rs. 1,500"), "1500");
  assert.equal(parseAmount("2 lakh"), "200000");
  assert.equal(parseAmount("1.5 lakh"), "150000");
  assert.equal(parseAmount("1 crore"), "10000000");
  assert.equal(parseAmount("50k"), "50000");
});

test("parseAmount returns undefined rather than guessing", () => {
  assert.equal(parseAmount("a lot of money"), undefined);
  assert.equal(parseAmount(""), undefined);
  assert.equal(parseAmount(undefined), undefined);
  assert.equal(parseAmount("0"), undefined);
});

test("normalizeDate resolves relative dates against today", () => {
  const today = new Date("2026-09-04T10:00:00Z");
  assert.equal(normalizeDate("yesterday", today), "2026-09-03");
  assert.equal(normalizeDate("today", today), "2026-09-04");
  assert.equal(normalizeDate("3 days ago", today), "2026-09-01");
  assert.equal(normalizeDate("kal", today), "2026-09-03");
});

test("normalizeDate handles absolute dates and passes ISO through", () => {
  const today = new Date("2026-09-04T10:00:00Z");
  assert.equal(normalizeDate("2026-08-24", today), "2026-08-24");
  assert.equal(normalizeDate("3 September", today), "2026-09-03");
  assert.equal(normalizeDate("25 August 2026", today), "2026-08-25");
});

test("normalizeDate returns undefined when there is no date to read", () => {
  assert.equal(normalizeDate("some time back"), undefined);
  assert.equal(normalizeDate(""), undefined);
});

test("normalizeChannel snaps onto niriksh's own channel enum", () => {
  assert.equal(normalizeChannel("instagram"), "Instagram");
  assert.equal(normalizeChannel("insta"), "Instagram");
  assert.equal(normalizeChannel("WhatsApp"), "WhatsApp");
  assert.equal(normalizeChannel("telegram"), "Telegram");
  assert.equal(normalizeChannel("sms"), "SMS");
  assert.equal(normalizeChannel("phone call"), "Phone call");
  for (const c of CHANNELS) assert.equal(normalizeChannel(c), c);
});

test("normalizeChannel never invents a value outside the enum", () => {
  assert.equal(normalizeChannel("some obscure app"), "Other");
  assert.equal(normalizeChannel(""), undefined);
  assert.ok(CHANNELS.includes(normalizeChannel("whatever")!));
});

test("normalizeIncidentStatus maps to niriksh's preferred spellings", () => {
  assert.equal(normalizeIncidentStatus("still happening"), "Still available or happening");
  assert.equal(normalizeIncidentStatus("still online"), "Still available or happening");
  assert.equal(normalizeIncidentStatus("taken down"), "Stopped or removed");
  assert.equal(normalizeIncidentStatus("removed"), "Stopped or removed");
});

test("checklistToComplaintDetails normalizes the UTR/amount/date shapes", () => {
  const details = checklistToComplaintDetails({
    category: "phishing_payment",
    values: { utr: "A12345678901", amount: "42000 rupees", bank_account: "HDFC", date: "yesterday", channel: "whatsapp", state: "Karnataka" },
    confirmed: true,
    today: new Date("2026-09-04T10:00:00Z"),
  });

  assert.equal(details.financial?.transactionId, "A12345678901");
  assert.equal(details.financial?.amount, "42000");
  assert.equal(details.incidentDate, "2026-09-03");
  assert.equal(details.financial?.involved, true);
  assert.equal(details.financial?.bankOrWallet, "HDFC");
  assert.equal(details.declarationConfirmed, true);
  assert.equal(details.selectedCategory, "financial");
  assert.equal(details.state, "Karnataka");
  assert.equal(details.channel, "WhatsApp");
});

test("checklistToComplaintDetails omits financial entirely when no money was involved", () => {
  const details = checklistToComplaintDetails({
    category: "threatening_messages",
    values: { sender_contact: "+919876543210", channel: "Telegram", incident_status: "still happening" },
  });
  assert.equal(details.financial, undefined);
  assert.equal(details.channel, "Telegram");
  assert.equal(details.incidentStatus, "Still available or happening");
  assert.equal(details.suspect?.phone, "+919876543210");
});

test("checklistToComplaintDetails routes a suspect identifier by its shape", () => {
  const email = checklistToComplaintDetails({ category: "threatening_messages", values: { sender_contact: "scammer@example.test" } });
  assert.equal(email.suspect?.email, "scammer@example.test");

  const url = checklistToComplaintDetails({ category: "threatening_messages", values: { sender_contact: "https://example.invalid/p/1" } });
  assert.equal(url.suspect?.profileOrWebsite, "https://example.invalid/p/1");

  const alias = checklistToComplaintDetails({ category: "threatening_messages", values: { sender_contact: "RaviTrader" } });
  assert.equal(alias.suspect?.nameOrAlias, "RaviTrader");
});

test("checklistToComplaintDetails marks aiMisuse for synthetic-media categories only", () => {
  const deepfake = checklistToComplaintDetails({ category: "investment_deepfake", values: { incident_status: "still online" } });
  assert.equal(deepfake.aiMisuse?.suspected, true);
  assert.equal(deepfake.aiMisuse?.distribution, "Still online or spreading");

  const phishing = checklistToComplaintDetails({ category: "phishing_payment", values: { utr: "X1" } });
  assert.equal(phishing.aiMisuse, undefined);
});

test("every chat scenario maps to a stable Niriksh subject folder", () => {
  assert.equal(checklistToComplaintDetails({ category: "phishing_payment" }).selectedCategory, "financial");
  assert.equal(checklistToComplaintDetails({ category: "threatening_messages" }).selectedCategory, "harassment");
  assert.equal(checklistToComplaintDetails({ category: "investment_deepfake" }).selectedCategory, "social");
  assert.equal(checklistToComplaintDetails({ category: "child_safety" }).selectedCategory, "sensitive");
});

test("checklistToComplaintDetails never sets declarationConfirmed unless the citizen confirmed", () => {
  const details = checklistToComplaintDetails({ category: "phishing_payment", values: { utr: "X1" } });
  assert.equal(details.declarationConfirmed, false);
});

test("buildNarrative always clears a usable minimum length", () => {
  const text = buildNarrative({ category: "phishing_payment", values: {}, summary: "" });
  assert.ok(text.length >= 40, `expected >=40 chars, got ${text.length}`);
});

test("buildNarrative carries collected details to the reviewer", () => {
  const text = buildNarrative({
    category: "phishing_payment",
    values: { utr: "A12345678901", amount: "42000 rupees" },
    summary: "Reporter lost money to a phishing link.",
  });
  assert.match(text, /A12345678901/);
  assert.match(text, /42000 rupees/);
});
