export type Severity = "Critical" | "High" | "Medium" | "Low" | "Needs review";
export type CaseStatus = "Awaiting review" | "In review" | "Routed" | "Needs information";

export interface Entity {
  type: string;
  value: string;
}

export interface EvidenceItem {
  name: string;
  type: "Video" | "Image" | "Document" | "Link" | "Audio";
  size: string;
  verified?: boolean;
  previewUrl?: string;
  mimeType?: string;
  demo?: boolean;
  sha256?: string;
  contextNote?: string;
  extractedText?: string;
  purpose?: "Voice description" | "Supporting evidence" | "Pasted message";
  originality?: "Original" | "Screenshot" | "Forwarded" | "Edited" | "Unknown" | "Demo";
}

export interface GroundedFact {
  label: string;
  value: string;
  source: string;
}

export interface TimelineEvent {
  when: string;
  what: string;
  source: string;
  precision: "Exact" | "Approximate" | "Repeated";
}

export interface EvidenceAnalysis {
  fileName: string;
  status: "AI reviewed" | "Content reviewed" | "File prepared";
  observations: string[];
  limitations: string[];
}

export interface MultimodalInsight {
  provider: "OpenAI" | "Gemini";
  model: string;
  situationSummary: string;
  category: string;
  severity: Severity;
  confidence: number;
  suspectedAiManipulation: boolean;
  importantIndicators: AnalysisHighlight[];
  evidenceFindings: Array<{
    fileName: string;
    observations: string[];
    visibleText: string[];
    concerningSignals: string[];
    limitations: string[];
  }>;
  timeline: TimelineEvent[];
  limitations: string[];
}

export interface AnalysisEngine {
  mode: "Multimodal AI" | "Local fallback";
  label: string;
  model?: string;
  mediaReviewed: number;
  limitations: string[];
}

export interface ComplaintDetails {
  selectedCategory?: string;
  incidentDate?: string;
  incidentTime?: string;
  delayReason?: string;
  state?: string;
  district?: string;
  policeStation?: string;
  channel?: string;
  accountOrUrl?: string;
  incidentStatus?: "Still available or happening" | "Stopped or removed" | "Not sure";
  reporterRole?: "Person affected" | "Parent or guardian" | "Reporting for someone else";
  financial?: {
    involved: boolean;
    bankOrWallet?: string;
    transactionId?: string;
    transactionDate?: string;
    amount?: string;
    moneyStatus?: "Transferred or debited" | "Payment attempted or stopped" | "No money sent" | "Not sure";
  };
  aiMisuse?: {
    suspected: boolean;
    mediaType?: "Image" | "Video" | "Audio / voice" | "Text / profile" | "Not sure";
    identityUsed?: "My identity" | "A child’s identity" | "Someone else’s identity" | "No identity used" | "Not sure";
    permission?: "No permission" | "Permission was given" | "Not sure";
    harmfulNature?: string[];
    contentUrl?: string;
    distribution?: "Still online or spreading" | "Removed or stopped" | "Not sure";
    takedownWanted?: boolean;
  };
  suspect?: {
    nameOrAlias?: string;
    phone?: string;
    email?: string;
    bankAccount?: string;
    profileOrWebsite?: string;
    address?: string;
  };
  declarationConfirmed?: boolean;
}

export interface AnalysisHighlight {
  label: string;
  detail: string;
  source: string;
  level: "Critical" | "Warning" | "Context";
}

export interface VerificationCheck {
  label: string;
  status: "Ready" | "Needs review" | "Missing";
  detail: string;
}

export interface VerificationSummary {
  readiness: number;
  readyChecks: number;
  totalChecks: number;
  checks: VerificationCheck[];
  disclaimer: string;
}

export interface RoutingInfo {
  status: "Ready for human routing" | "Needs information before routing";
  jurisdiction: string;
  primaryUnit: string;
  supportingUnits: string[];
  reasons: string[];
}

export interface TakedownRecommendation {
  recommended: boolean;
  title: string;
  reasons: string[];
  preservationSteps: string[];
}

export interface AnalysisConcern {
  issue: string;
  question: string;
}

export interface ContextProfile {
  reporterRole: string;
  incidentStatus: string;
  harm: string[];
  actionsTaken: string[];
}

export interface AuditEvent {
  label: string;
  detail: string;
  time: string;
  actor: string;
}

export interface TriageCase {
  id: string;
  reference: string;
  summary: string;
  description: string;
  category: string;
  secondary: string[];
  severity: Severity;
  severityScore: number;
  status: CaseStatus;
  completeness: number;
  aiSuspected: boolean;
  createdAt: string;
  createdLabel: string;
  platform?: string;
  location?: string;
  department: string[];
  entities: Entity[];
  evidence: EvidenceItem[];
  missing: string[];
  riskFactors: string[];
  audit: AuditEvent[];
  confidence: number;
  analysisDetails?: AnalysisResult;
  complaintDetails?: ComplaintDetails;
  citizenVerification?: {
    status: "Confirmed" | "Partially confirmed" | "Not reviewed";
    summaryConfirmed: boolean;
    confirmedEntities: number;
    totalEntities: number;
    confirmedAt?: string;
  };
}

export interface AnalysisResult {
  summary: string;
  category: string;
  secondary: string[];
  severity: Severity;
  score: number;
  completeness: number;
  departments: string[];
  entities: Entity[];
  missing: string[];
  questions: string[];
  riskFactors: string[];
  confidence: number;
  aiSuspected: boolean;
  context: ContextProfile;
  facts: GroundedFact[];
  timeline: TimelineEvent[];
  evidenceAnalysis: EvidenceAnalysis[];
  concerns: AnalysisConcern[];
  reasons: string[];
  highlights: AnalysisHighlight[];
  verification: VerificationSummary;
  routing: RoutingInfo;
  takedown: TakedownRecommendation;
  engine?: AnalysisEngine;
  multimodal?: MultimodalInsight;
}
