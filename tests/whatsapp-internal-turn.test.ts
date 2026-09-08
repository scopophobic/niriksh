// Auth guard for the internal WhatsApp turn route (app/api/internal/whatsapp/turn/route.ts) —
// this endpoint is called only by Niriksh's own Python backend, never a browser, so it must
// refuse anything that doesn't carry the shared secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../app/api/internal/whatsapp/turn/route";

const ORIGINAL_KEY = process.env.WHATSAPP_INTERNAL_KEY;

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/internal/whatsapp/turn", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("internal turn route refuses requests when no shared secret is configured", async () => {
  delete process.env.WHATSAPP_INTERNAL_KEY;
  const res = await POST(request({ type: "text", text: "hello" }));
  assert.equal(res.status, 503);
});

test("internal turn route refuses requests missing the header", async () => {
  process.env.WHATSAPP_INTERNAL_KEY = "test-secret";
  const res = await POST(request({ type: "text", text: "hello" }));
  assert.equal(res.status, 401);
});

test("internal turn route refuses requests with the wrong key", async () => {
  process.env.WHATSAPP_INTERNAL_KEY = "test-secret";
  const res = await POST(request({ type: "text", text: "hello" }, { "x-niriksh-internal-key": "wrong" }));
  assert.equal(res.status, 401);
});

test("internal turn route accepts a correctly authenticated turn", async () => {
  process.env.WHATSAPP_INTERNAL_KEY = "test-secret";
  const res = await POST(request(
    { mode: "full", type: "text", text: "Someone is threatening me on WhatsApp", history: [] },
    { "x-niriksh-internal-key": "test-secret" },
  ));
  assert.equal(res.status, 200);
  const data = await res.json() as { category?: string; messages?: unknown[] };
  assert.ok(data.category, "expected a locked category from the fixture analyzer");
  assert.ok(Array.isArray(data.messages) && data.messages.length > 0);
});

test.after(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.WHATSAPP_INTERNAL_KEY;
  else process.env.WHATSAPP_INTERNAL_KEY = ORIGINAL_KEY;
});
