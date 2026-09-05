import { analyzeComplaint } from "./analyzer";
import { ComplaintDetails, EvidenceItem } from "./types";

export interface BenchmarkScenario {
  id: string;
  description: string;
  details: ComplaintDetails;
  evidence?: EvidenceItem[];
  expectedEntityTypes?: string[];
  expectConcern?: boolean;
}

export const BENCHMARK_SCENARIOS: BenchmarkScenario[] = [
  {
    id: "financial-identifiers",
    description: "Yesterday an SMS asked for ₹12,600 to demo-payee@upi.",
    details: { selectedCategory: "financial" },
    expectedEntityTypes: ["Amount", "UPI ID", "Platform"],
  },
  {
    id: "source-attributed-evidence",
    description: "I saved the conversation.",
    details: { selectedCategory: "harassment" },
    evidence: [{ name: "chat.txt", type: "Document", size: "1 KB", extractedText: "Yesterday the sender said they know where I work." }],
  },
  {
    id: "contradictory-payment",
    description: "No money was sent at first, but later I paid ₹5,000 through the bank yesterday.",
    details: { selectedCategory: "financial" },
    expectedEntityTypes: ["Amount"],
    expectConcern: true,
  },
];

export function evaluateScenario(scenario: BenchmarkScenario) {
  const result = analyzeComplaint(scenario.description, scenario.evidence || [], scenario.details);
  const entities = new Set(result.entities.map(entity => entity.type));
  const entitiesPassed = (scenario.expectedEntityTypes || []).every(type => entities.has(type));
  const concernPassed = scenario.expectConcern === undefined || (result.concerns.length > 0) === scenario.expectConcern;
  const decisionBoundaryPassed = result.severity === "Needs review" && result.score === 0 && result.confidence === 0;
  return { scenario, result, entitiesPassed, concernPassed, decisionBoundaryPassed, passed: entitiesPassed && concernPassed && decisionBoundaryPassed };
}

export function runBenchmark() {
  const results = BENCHMARK_SCENARIOS.map(evaluateScenario);
  return { results, total: results.length, passed: results.filter(result => result.passed).length };
}
