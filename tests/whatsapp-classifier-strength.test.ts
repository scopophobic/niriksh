// Case-strength weighting for the /whatsapp checklist — ported from Bhumika's
// umang-reimagined repo (tests/niriksh-strength.test.js).
//
// These numbers are shown to the citizen as "+N%" next to each unfilled item, so the property
// that actually matters is that the advertised numbers ARE the scored numbers — a row promising
// +10% must move the bar by 10.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORIES, CategoryKey, checklistView, blankFields } from "../lib/whatsapp-classifier";

const CATS = Object.keys(CATEGORIES) as CategoryKey[];

test("every category's weights total 100", () => {
  for (const key of CATS) {
    const total = checklistView(key, blankFields(key), {}).reduce((s, f) => s + f.deltaPct, 0);
    assert.ok(Math.abs(total - 100) <= 2, `${key}: weights total ${total}, expected ~100`);
  }
});

test("a required field always outweighs an optional one", () => {
  for (const key of CATS) {
    const view = checklistView(key, blankFields(key), {});
    const required = view.filter(f => f.required);
    const optional = view.filter(f => !f.required);
    if (!required.length || !optional.length) continue;
    const minRequired = Math.min(...required.map(f => f.deltaPct));
    const maxOptional = Math.max(...optional.map(f => f.deltaPct));
    assert.ok(minRequired > maxOptional, `${key}: optional field worth ${maxOptional}% outranks a required one worth ${minRequired}%`);
  }
});

test("the optional set never outweighs the required set", () => {
  for (const key of CATS) {
    const view = checklistView(key, blankFields(key), {});
    const req = view.filter(f => f.required).reduce((s, f) => s + f.deltaPct, 0);
    const opt = view.filter(f => !f.required).reduce((s, f) => s + f.deltaPct, 0);
    if (!opt) continue;
    assert.ok(req > opt, `${key}: optional total ${opt}% >= required total ${req}%`);
  }
});

test("the UTR outweighs district on a phishing case", () => {
  const view = checklistView("phishing_payment", blankFields("phishing_payment"), {});
  const utr = view.find(f => f.key === "utr")!;
  const district = view.find(f => f.key === "district")!;
  assert.ok(utr.deltaPct > district.deltaPct, `UTR (${utr.deltaPct}%) should outweigh district (${district.deltaPct}%)`);
});
