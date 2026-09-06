// Confirmation detection for the /whatsapp "Send now" gate — ported from Bhumika's
// umang-reimagined repo (tests/niriksh-confirm.test.js).
//
// This gate decides whether a case is filed, so the two directions of error are not equal:
// missing a "yes" costs the citizen one extra tap, while reading a correction as a "yes"
// files a case they were actively trying to fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectConfirmation } from "../lib/whatsapp-classifier";

test("detectConfirmation accepts plain affirmatives", () => {
  for (const s of ["yes", "Yes", "yeah", "yep", "ok", "okay", "sure", "confirm", "send it", "submit", "go ahead", "done", "correct"]) {
    assert.equal(detectConfirmation(s), true, `expected "${s}" to confirm`);
  }
});

test("detectConfirmation accepts the Hinglish a citizen actually types", () => {
  for (const s of ["haan", "han", "ji", "theek hai", "thik hai", "sahi hai", "bilkul", "bhej do", "haan bhej do", "kar do"]) {
    assert.equal(detectConfirmation(s), true, `expected "${s}" to confirm`);
  }
});

test("detectConfirmation rejects a QUALIFIED yes", () => {
  for (const s of [
    "yes but the amount is wrong",
    "haan par UTR galat hai",
    "ok wait",
    "yes, actually change the bank",
    "correct it please",
    "yes no hold on",
  ]) {
    assert.equal(detectConfirmation(s), false, `expected "${s}" NOT to confirm`);
  }
});

test("detectConfirmation rejects negations", () => {
  for (const s of ["no", "nope", "nahi", "not yet", "no don't send"]) {
    assert.equal(detectConfirmation(s), false, `expected "${s}" NOT to confirm`);
  }
});

test("detectConfirmation treats a long message as new detail, not a yes", () => {
  const s = "ok so the scammer also called me from another number yesterday";
  assert.equal(detectConfirmation(s), false);
});

test("detectConfirmation ignores empty input", () => {
  assert.equal(detectConfirmation(""), false);
  assert.equal(detectConfirmation(undefined), false);
  assert.equal(detectConfirmation("   "), false);
});

test("detectConfirmation does not fire on unrelated content", () => {
  assert.equal(detectConfirmation("I lost 42000 rupees"), false);
  assert.equal(detectConfirmation("UTR is A12345678901"), false);
});
