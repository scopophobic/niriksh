import assert from "node:assert/strict";
import test from "node:test";
import { buildPreventionGraph, type PreventionPattern } from "../lib/prevention-graph";

const pattern: PreventionPattern = {
  id: "pattern-1",
  title: "Shared payment route",
  status: "UNREVIEWED",
  complaint_count: 3,
  first_seen: "2026-09-01T00:00:00Z",
  last_seen: "2026-09-03T00:00:00Z",
  reasons: [],
  supporting_cases: [
    { id: "a", reference: "CYB-A", summary: "A", category: "Financial fraud", status: "In review", created_at: "2026-09-01T00:00:00Z" },
    { id: "b", reference: "CYB-B", summary: "B", category: "Financial fraud", status: "In review", created_at: "2026-09-02T00:00:00Z" },
    { id: "c", reference: "CYB-C", summary: "C", category: "Phishing", status: "Routed", created_at: "2026-09-03T00:00:00Z" },
  ],
  indicators: [
    { type: "upi", type_label: "UPI ID", display_value: "shared@upi", case_count: 2, case_ids: ["a", "b"], sources: ["Reporter narrative"] },
    { type: "domain", type_label: "Domain", display_value: "shared.example", case_count: 3, case_ids: ["a", "b", "c"], sources: ["Evidence: screenshot.png"] },
  ],
};

test("buildPreventionGraph creates only evidence-backed case-to-signal edges", () => {
  const graph = buildPreventionGraph(pattern);
  assert.equal(graph.cases.length, 3);
  assert.equal(graph.signals.length, 2);
  assert.equal(graph.edges.length, 5);
  assert.equal(graph.edges.some(edge => edge.case.id === "c" && edge.indicator.type === "upi"), false);
  assert.equal(graph.cases.find(node => node.case.id === "c")?.connectionCount, 1);
});

test("buildPreventionGraph does not guess partial legacy signal membership", () => {
  const graph = buildPreventionGraph({
    ...pattern,
    indicators: [{ type: "phone", type_label: "Phone", display_value: "9000000000", case_count: 2, sources: ["Complaint record"] }],
  });
  assert.equal(graph.edges.length, 0);
});
