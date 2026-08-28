import assert from "node:assert/strict";
import test from "node:test";
import { analyzeComplaint } from "../lib/analyzer";
import { runBenchmark } from "../lib/analysis-benchmark";
import { addLocalEngine, mergeMultimodalAnalysis } from "../lib/multimodal";
import { ComplaintDetails, MultimodalInsight } from "../lib/types";

test("featured scenario becomes critical and reaches both specialist teams", () => {
  const result = analyzeComplaint("Someone created a fake AI video of me for an investment scam. It is being shared on Instagram at https://instagram.com/demo. My colleague already transferred ₹25,000 to returnsfast@upi yesterday.", 2);
  assert.equal(result.category, "Synthetic media impersonation");
  assert.equal(result.severity, "Critical");
  assert.ok(result.departments.includes("Financial Fraud Unit"));
  assert.ok(result.departments.includes("Synthetic Media Review"));
  assert.ok(result.entities.some(item => item.type === "UPI ID"));
});

test("ambiguous input admits that human review is needed", () => {
  const result = analyzeComplaint("There are strange things happening to my accounts and videos. Please check.");
  assert.equal(result.category, "Unclear / needs review");
  assert.equal(result.severity, "Needs review");
  assert.ok(result.confidence < 50);
});

test("child-safety risk is a hard critical escalation", () => {
  const result = analyzeComplaint("A fake explicit image of my minor daughter is circulating online.", 1);
  assert.equal(result.severity, "Critical");
  assert.equal(result.score, 100);
  assert.equal(result.departments[0], "Women & Child Safety");
});

test("threatening chat sample is prioritised with useful evidence readiness", () => {
  const result = analyzeComplaint("An unknown account sends threats every night. Yesterday they said they know where I work and may harm me. The messages are ongoing.", 1);
  assert.equal(result.category, "Threats");
  assert.equal(result.severity, "Critical");
  assert.ok(result.riskFactors.includes("Immediate physical threat"));
  assert.ok(result.completeness >= 50);
});

test("evidence text can supply context that is missing from the description", () => {
  const result = analyzeComplaint("I received these messages and need help understanding them.", [{
    name: "chat.txt",
    type: "Document",
    size: "1 KB",
    extractedText: "Yesterday. I know where you work. You will regret blocking this account.",
    contextNote: "These messages came from an unknown account.",
  }]);
  assert.equal(result.category, "Threats");
  assert.ok(result.timeline.some(event => event.source === "Evidence: chat.txt"));
  assert.ok(result.reasons.some(reason => reason.includes("file chat.txt")));
  assert.equal(result.evidenceAnalysis[0].status, "Content reviewed");
});

test("multiple evidence types are combined without losing source attribution", () => {
  const evidence = [
    { name: "chat.png", type: "Image" as const, size: "210 KB", extractedText: "Yesterday. Stop contacting me. I know where you work.", contextNote: "Screenshot from an unknown account." },
    { name: "call.mp3", type: "Audio" as const, size: "2.4 MB", extractedText: "The caller asked for an urgent payment and used my brother's name." },
    { name: "receipt.pdf", type: "Document" as const, size: "180 KB", extractedText: "Transaction amount: ₹8,500. The transaction happened yesterday." },
  ];
  const result = analyzeComplaint("Someone contacted me online and I am unsure what happened.", evidence);
  assert.equal(result.evidenceAnalysis.length, 3);
  assert.ok(result.evidenceAnalysis.every(item => item.status === "Content reviewed"));
  assert.ok(result.timeline.some(event => event.source === "Evidence: chat.png"));
  assert.ok(result.timeline.some(event => event.source === "Evidence: receipt.pdf"));
  assert.ok(result.entities.some(entity => entity.type === "Amount" && entity.value.includes("8,500")));
});

test("context pipeline preserves actions and uncertainty", () => {
  const result = analyzeComplaint("Someone keeps contacting me every night. I blocked the account and saved a screenshot, but I do not know which app it came from.", 1);
  assert.equal(result.context.reporterRole, "Person affected");
  assert.equal(result.context.incidentStatus, "Still happening");
  assert.ok(result.context.actionsTaken.includes("Blocked the account or contact"));
  assert.ok(result.context.actionsTaken.includes("Saved a copy of the evidence"));
  assert.ok(result.timeline.some(event => event.precision === "Repeated"));
});

test("contradictory money statements become a question instead of a conclusion", () => {
  const result = analyzeComplaint("No money was sent at first, but later I paid ₹5,000 through the bank yesterday.");
  assert.ok(result.concerns.some(concern => concern.issue.includes("different statements")));
  assert.ok(result.questions.some(question => question.includes("successfully transferred")));
});

test("negated threat language does not create a threat finding", () => {
  const result = analyzeComplaint("The sender wrote that this is not a threat and only asked me to confirm a meeting tomorrow.");
  assert.notEqual(result.category, "Threats");
  assert.ok(!result.riskFactors.includes("Immediate physical threat"));
});

test("email addresses remain emails rather than payment identifiers", () => {
  const result = analyzeComplaint("A fake login message came from alerts@example.com yesterday and asked for my password.");
  assert.ok(result.entities.some(entity => entity.type === "Email" && entity.value === "alerts@example.com"));
  assert.ok(!result.entities.some(entity => entity.type === "UPI ID"));
});

test("every controlled analysis scenario meets its expected outcome", () => {
  const benchmark = runBenchmark();
  const failures = benchmark.results
    .filter(result => !result.passed)
    .map(result => `${result.scenario.id}: expected ${result.scenario.expectedCategory}/${result.scenario.expectedSeverity}, received ${result.result.category}/${result.result.severity}`);
  assert.equal(benchmark.passed, benchmark.total, failures.join("\n"));
});

test("structured AI-misuse details create highlights, verification and takedown guidance", () => {
  const details: ComplaintDetails = {
    selectedCategory: "AI-generated harmful or deceptive content",
    incidentDate: "2026-08-26",
    incidentTime: "20:10",
    state: "Delhi",
    district: "New Delhi",
    channel: "Instagram",
    accountOrUrl: "https://instagram.com/reel/synthetic-demo",
    incidentStatus: "Still available or happening",
    reporterRole: "Person affected",
    aiMisuse: {
      suspected: true,
      mediaType: "Video",
      identityUsed: "My identity",
      permission: "No permission",
      harmfulNature: ["Sexual or intimate", "Humiliating or defamatory"],
      contentUrl: "https://instagram.com/reel/synthetic-demo",
      distribution: "Still online or spreading",
      takedownWanted: true,
    },
    financial: { involved: false },
    declarationConfirmed: true,
  };
  const result = analyzeComplaint("An account posted an AI-generated explicit video using my face. I never agreed to this and the post is still spreading.", [], details);
  assert.equal(result.category, "AI-generated harmful content");
  assert.equal(result.severity, "Critical");
  assert.ok(result.highlights.some(item => item.label === "Possible non-consensual intimate content"));
  assert.equal(result.takedown.recommended, true);
  assert.equal(result.routing.status, "Ready for human routing");
  assert.ok(result.facts.some(item => item.label === "State / UT" && item.value === "Delhi"));
});

test("multimodal findings are merged without hiding the human-verification boundary", () => {
  const local = analyzeComplaint("An unknown profile sent this screenshot yesterday and I am worried about it.", [{
    name: "chat.png",
    type: "Image",
    size: "200 KB",
    sha256: "demo",
  }]);
  const insight: MultimodalInsight = {
    provider: "OpenAI",
    model: "test-vision-model",
    situationSummary: "The supplied screenshot appears to contain a threat that needs urgent human review.",
    category: "Threats",
    severity: "High",
    confidence: 88,
    suspectedAiManipulation: false,
    importantIndicators: [{ label: "Threatening visible text", detail: "The screenshot contains language indicating possible harm.", source: "chat.png", level: "Critical" }],
    evidenceFindings: [{ fileName: "chat.png", observations: ["A direct message conversation is visible"], visibleText: ["I know where you live"], concerningSignals: ["Possible threat"], limitations: ["Screenshot metadata is unavailable"] }],
    timeline: [{ when: "Yesterday", what: "The screenshot was reportedly received", source: "chat.png", precision: "Approximate" }],
    limitations: ["This is not a forensic authenticity assessment."],
  };
  const result = mergeMultimodalAnalysis(local, insight);
  assert.equal(result.engine?.mode, "Multimodal AI");
  assert.equal(result.evidenceAnalysis[0].status, "AI reviewed");
  assert.ok(result.evidenceAnalysis[0].observations.some(item => item.includes("Visible text")));
  assert.ok(result.verification.disclaimer.includes("does not prove"));
  assert.equal(result.severity, "High");
});

test("local fallback states that uploaded media was not interpreted", () => {
  const result = addLocalEngine(analyzeComplaint("A profile sent me repeated unwanted messages yesterday.", 1), 1);
  assert.equal(result.engine?.mode, "Local fallback");
  assert.equal(result.engine?.mediaReviewed, 0);
  assert.ok(result.engine?.limitations[0].includes("not been interpreted"));
});

test("video findings survive harmless source-label changes", () => {
  const local = analyzeComplaint("A video was posted yesterday and appears to impersonate me.", [{
    name: "incident-video.mp4",
    type: "Video",
    size: "4.2 MB",
    sha256: "video-demo",
  }]);
  const insight: MultimodalInsight = {
    provider: "Gemini",
    model: "test-video-model",
    situationSummary: "The video shows a person promoting a payment request.",
    category: "Impersonation",
    severity: "Medium",
    confidence: 80,
    suspectedAiManipulation: true,
    importantIndicators: [],
    evidenceFindings: [{
      fileName: "Video evidence source: incident-video.mp4",
      observations: ["At 00:03, a payment request appears on screen"],
      visibleText: ["Send payment now"],
      concerningSignals: ["Possible identity misuse"],
      limitations: ["Authenticity cannot be established from visual review alone"],
    }],
    timeline: [],
    limitations: [],
  };
  const result = mergeMultimodalAnalysis(local, insight);
  assert.equal(result.evidenceAnalysis[0].status, "AI reviewed");
  assert.ok(result.evidenceAnalysis[0].observations.some(item => item.includes("00:03")));
  assert.equal(result.engine?.mediaReviewed, 1);
});

test("a video preparation failure is shown on that file and is not counted as reviewed", () => {
  const local = analyzeComplaint("A video was uploaded for review.", [{
    name: "long-video.mov",
    type: "Video",
    size: "9.8 MB",
    sha256: "video-timeout",
  }]);
  const insight: MultimodalInsight = {
    provider: "Gemini",
    model: "test-video-model",
    situationSummary: "The complaint was analysed, but the video was unavailable.",
    category: "Needs more information",
    severity: "Needs review",
    confidence: 30,
    suspectedAiManipulation: false,
    importantIndicators: [],
    evidenceFindings: [],
    timeline: [],
    limitations: ["long-video.mov: the file was still being prepared after 75 seconds."],
  };
  const result = mergeMultimodalAnalysis(local, insight);
  assert.notEqual(result.evidenceAnalysis[0].status, "AI reviewed");
  assert.ok(result.evidenceAnalysis[0].limitations.some(item => item.includes("75 seconds")));
  assert.equal(result.engine?.mediaReviewed, 0);
});
