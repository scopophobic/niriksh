import assert from "node:assert/strict";
import test from "node:test";
import { analyzeComplaint } from "../lib/analyzer";
import { addLocalEngine, mergeMultimodalAnalysis } from "../lib/multimodal";
import { ComplaintDetails, MultimodalInsight } from "../lib/types";

test("the reporter-selected subject folder is used without priority scoring", () => {
  const details: ComplaintDetails = { selectedCategory: "financial" };
  const result = analyzeComplaint("Yesterday a payment request on Instagram asked me to transfer ₹25,000 to returnsfast@upi.", 1, details);
  assert.equal(result.category, "Financial fraud");
  assert.deepEqual(result.departments, ["Financial complaint review"]);
  assert.equal(result.severity, "Needs review");
  assert.equal(result.score, 0);
  assert.equal(result.confidence, 0);
  assert.ok(result.entities.some(item => item.type === "UPI ID"));
});

test("an unselected complaint stays in the needs-category-review folder", () => {
  const result = analyzeComplaint("There are strange things happening to my accounts and videos. Please check.");
  assert.equal(result.category, "Other / needs category review");
  assert.equal(result.severity, "Needs review");
  assert.equal(result.score, 0);
});

test("sensitive wording becomes sourced context, never an escalation score", () => {
  const result = analyzeComplaint("A fake explicit image of my minor daughter is circulating online.", 1, { selectedCategory: "sensitive" });
  assert.equal(result.category, "Sexual exploitation and child safety");
  assert.equal(result.score, 0);
  assert.ok(result.riskFactors.some(item => item.includes("child")));
  assert.ok(result.highlights.every(item => item.level === "Context"));
});

test("evidence text supplies context with source attribution", () => {
  const result = analyzeComplaint("I received these messages and need help understanding them.", [{
    name: "chat.txt",
    type: "Document",
    size: "1 KB",
    extractedText: "Yesterday. I know where you work. You will regret blocking this account.",
    contextNote: "These messages came from an unknown account.",
  }], { selectedCategory: "harassment" });
  assert.ok(result.timeline.some(event => event.source === "Evidence: chat.txt"));
  assert.equal(result.evidenceAnalysis[0].status, "Content reviewed");
  assert.equal(result.routing.primaryUnit, "Harassment and extortion review");
});

test("multiple evidence types retain details and source attribution", () => {
  const evidence = [
    { name: "chat.png", type: "Image" as const, size: "210 KB", extractedText: "Yesterday. Stop contacting me. I know where you work." },
    { name: "call.mp3", type: "Audio" as const, size: "2.4 MB", extractedText: "The caller asked for a payment and used my brother's name." },
    { name: "receipt.pdf", type: "Document" as const, size: "180 KB", extractedText: "Transaction amount: ₹8,500. The transaction happened yesterday." },
  ];
  const result = analyzeComplaint("Someone contacted me online and I am unsure what happened.", evidence, { selectedCategory: "financial" });
  assert.equal(result.evidenceAnalysis.length, 3);
  assert.ok(result.evidenceAnalysis.every(item => item.status === "Content reviewed"));
  assert.ok(result.entities.some(entity => entity.type === "Amount" && entity.value.includes("8,500")));
});

test("contradictory money statements become a question instead of a conclusion", () => {
  const result = analyzeComplaint("No money was sent at first, but later I paid ₹5,000 through the bank yesterday.", 0, { selectedCategory: "financial" });
  assert.ok(result.concerns.some(concern => concern.issue.includes("different statements")));
  assert.ok(result.questions.some(question => question.includes("successfully transferred")));
});

test("email addresses remain emails rather than payment identifiers", () => {
  const result = analyzeComplaint("A fake login message came from alerts@example.com yesterday and asked for my password.", 0, { selectedCategory: "access" });
  assert.ok(result.entities.some(entity => entity.type === "Email" && entity.value === "alerts@example.com"));
  assert.ok(!result.entities.some(entity => entity.type === "UPI ID"));
});

test("connected media extraction cannot override folder or create priority", () => {
  const local = analyzeComplaint("An unknown profile sent this screenshot yesterday.", [{ name: "chat.png", type: "Image", size: "200 KB", sha256: "demo" }], { selectedCategory: "social" });
  const insight: MultimodalInsight = {
    provider: "Gemini",
    model: "test-vision-model",
    situationSummary: "The screenshot contains a payment request and threatening wording.",
    importantIndicators: [{ label: "Visible wording", detail: "A payment request is visible.", source: "chat.png", level: "Warning" }],
    evidenceFindings: [{ fileName: "chat.png", observations: ["A direct message is visible"], visibleText: ["Send payment now"], concerningSignals: ["Payment request"], limitations: ["Metadata is unavailable"] }],
    timeline: [{ when: "Yesterday", what: "The screenshot was reportedly received", source: "chat.png", precision: "Approximate" }],
    limitations: ["This is not a forensic authenticity assessment."],
  };
  const result = mergeMultimodalAnalysis(local, insight);
  assert.equal(result.category, "Social media and identity misuse");
  assert.equal(result.severity, "Needs review");
  assert.equal(result.score, 0);
  assert.equal(result.confidence, 0);
  assert.ok(result.highlights.every(item => item.level === "Context"));
  assert.equal(result.evidenceAnalysis[0].status, "AI reviewed");
});

test("local fallback discloses that uploaded media was not interpreted", () => {
  const result = addLocalEngine(analyzeComplaint("A profile sent repeated messages yesterday.", 1, { selectedCategory: "social" }), 1);
  assert.equal(result.engine?.mode, "Local fallback");
  assert.equal(result.engine?.mediaReviewed, 0);
  assert.ok(result.engine?.limitations[0].includes("not been interpreted"));
});
