import catalog from "../backend/app/modules/review/categories.json";
import type { TriageCase } from "./types";

export const REVIEW_CATEGORIES = catalog;

const aliases: Record<string, string> = {
  "financial fraud or phishing": "financial",
  "online financial fraud": "financial",
  "social media harassment or impersonation": "social",
  "threatening messages, stalking or blackmail": "harassment",
  "non-consensual intimate content": "sensitive",
  "account compromise or unauthorised access": "access",
  "malware, ransomware or data theft": "systems",
  "other or not sure": "other",
  "not selected — analyse from context": "other",
  "online threats, stalking or harassment": "harassment",
  "ai-generated harmful or deceptive content": "social",
};

export function reviewCategory(value?: string) {
  const normalized = value?.trim().toLocaleLowerCase() || "other";
  const id = aliases[normalized] || normalized;
  return catalog.find(category => category.id === id || category.label.toLocaleLowerCase() === id) || catalog[catalog.length - 1];
}

export function reviewCase(item: TriageCase): TriageCase {
  const folder = reviewCategory(item.reviewCategory || item.complaintDetails?.selectedCategory);
  return {
    ...item,
    reviewCategory: folder.id,
    category: folder.label,
    secondary: [],
    severity: "Needs review",
    severityScore: 0,
    confidence: 0,
    department: [folder.team],
    analysisDetails: item.analysisDetails ? {
      ...item.analysisDetails,
      category: folder.label,
      secondary: [],
      severity: "Needs review",
      score: 0,
      confidence: 0,
      departments: [folder.team],
      highlights: item.analysisDetails.highlights.map(highlight => ({ ...highlight, level: "Context" })),
      routing: {
        ...item.analysisDetails.routing,
        primaryUnit: folder.team,
        supportingUnits: [],
        reasons: ["Subject folder selected by a person; reviewer confirms the destination."],
      },
    } : undefined,
  };
}
