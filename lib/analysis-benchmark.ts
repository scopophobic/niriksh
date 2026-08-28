import { analyzeComplaint } from "./analyzer";
import { EvidenceItem, Severity } from "./types";

export interface BenchmarkScenario {
  id: string;
  title: string;
  purpose: string;
  description: string;
  evidence?: EvidenceItem[];
  expectedCategory: string;
  expectedSeverity: Severity;
  expectedEntityTypes?: string[];
  expectConcern?: boolean;
}

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "synthetic-fraud",
    title: "Fake investment video",
    purpose: "Synthetic media, identity misuse and financial loss",
    description: "Someone created a fake AI video of me promoting an investment scheme. It is being shared from @wealthgrow_daily on Instagram. My colleague transferred ₹25,000 to returnsfast@upi yesterday and the post is still live.",
    evidence: [{ name: "post-notes.txt", type: "Document", size: "1 KB", extractedText: "Instagram post by @wealthgrow_daily. Send payment to returnsfast@upi.", originality: "Screenshot" }],
    expectedCategory: "Synthetic media impersonation",
    expectedSeverity: "Critical",
    expectedEntityTypes: ["Platform", "Username", "UPI ID", "Amount"],
  },
  {
    id: "ai-harmful-content",
    title: "AI-generated harmful content",
    purpose: "Non-consensual synthetic content, identity misuse and active distribution",
    description: "Someone used AI to create a fake explicit video using my face without consent. It is still being shared on Instagram and is humiliating me. I saved the link https://instagram.com/reel/synthetic-demo yesterday.",
    expectedCategory: "AI-generated harmful content",
    expectedSeverity: "Critical",
    expectedEntityTypes: ["Platform", "URL"],
  },
  {
    id: "threat-evidence",
    title: "Threatening conversation",
    purpose: "Evidence adds the most important context",
    description: "An unknown account keeps sending messages and I saved the conversation.",
    evidence: [{ name: "chat.txt", type: "Document", size: "1 KB", extractedText: "Yesterday. I know where you work. You will regret blocking this account.", contextNote: "The messages arrive every night." }],
    expectedCategory: "Threats",
    expectedSeverity: "Critical",
  },
  {
    id: "phishing-loss",
    title: "KYC phishing message",
    purpose: "Phishing, password request and financial loss",
    description: "Yesterday I received an SMS saying my bank KYC had expired. The fake login page asked for my password and ₹12,600 was debited.",
    expectedCategory: "Phishing",
    expectedSeverity: "High",
    expectedEntityTypes: ["Platform", "Amount"],
  },
  {
    id: "account-takeover",
    title: "Account takeover",
    purpose: "Unauthorised login and lost account access",
    description: "Today I received an unauthorised login alert. Someone changed my password and I am locked out of the account.",
    expectedCategory: "Account compromise",
    expectedSeverity: "Medium",
  },
  {
    id: "profile-copy",
    title: "Copied social profile",
    purpose: "Identity misuse without an urgent safety signal",
    description: "Someone created a fake Facebook account using my name and profile picture and is pretending to be me.",
    expectedCategory: "Social media impersonation",
    expectedSeverity: "Low",
    expectedEntityTypes: ["Platform"],
  },
  {
    id: "child-safety",
    title: "Child safety escalation",
    purpose: "Hard safety escalation for a minor",
    description: "A fake explicit image of my minor daughter is circulating online every day.",
    expectedCategory: "Synthetic child safety risk",
    expectedSeverity: "Critical",
  },
  {
    id: "contradictory-payment",
    title: "Conflicting payment details",
    purpose: "Contradictions should become questions",
    description: "No money was sent at first, but later I paid ₹5,000 through the bank yesterday.",
    expectedCategory: "Online financial fraud",
    expectedSeverity: "High",
    expectedEntityTypes: ["Amount"],
    expectConcern: true,
  },
  {
    id: "negated-threat",
    title: "Negated threat wording",
    purpose: "The word 'threat' should not be enough by itself",
    description: "The sender wrote that this is not a threat and only asked me to confirm a meeting tomorrow.",
    expectedCategory: "Unclear / needs review",
    expectedSeverity: "Needs review",
  },
  {
    id: "insufficient-context",
    title: "Not enough information",
    purpose: "The analyser should admit uncertainty",
    description: "There are strange things happening to my accounts and videos. Please check.",
    expectedCategory: "Unclear / needs review",
    expectedSeverity: "Needs review",
  },
];

export function evaluateScenario(scenario: BenchmarkScenario) {
  const result = analyzeComplaint(scenario.description, scenario.evidence || []);
  const categoryPassed = result.category === scenario.expectedCategory;
  const severityPassed = result.severity === scenario.expectedSeverity;
  const entityTypes = new Set(result.entities.map(entity => entity.type));
  const entitiesPassed = (scenario.expectedEntityTypes || []).every(type => entityTypes.has(type));
  const concernPassed = scenario.expectConcern === undefined || (result.concerns.length > 0) === scenario.expectConcern;
  return { scenario, result, categoryPassed, severityPassed, entitiesPassed, concernPassed, passed: categoryPassed && severityPassed && entitiesPassed && concernPassed };
}

export function runBenchmark() {
  const results = BENCHMARK_SCENARIOS.map(evaluateScenario);
  return {
    results,
    total: results.length,
    passed: results.filter(result => result.passed).length,
    categoriesPassed: results.filter(result => result.categoryPassed).length,
    prioritiesPassed: results.filter(result => result.severityPassed).length,
    entityChecksPassed: results.filter(result => result.entitiesPassed).length,
  };
}
