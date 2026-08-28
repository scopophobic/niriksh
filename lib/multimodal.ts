import { AnalysisHighlight, AnalysisResult, EvidenceAnalysis, MultimodalInsight, Severity, TimelineEvent } from "./types";

const severityRank: Record<Severity, number> = {
  "Needs review": 0,
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

function unique(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

function originalFileName(name: string) {
  return name.replace(/__frame_\d+\.jpg$/i, "");
}

function comparableFileName(name: string) {
  return originalFileName(name)
    .split(/[\\/]/).pop()!
    .replace(/^(?:image|audio|video|document|text) evidence source:\s*/i, "")
    .trim()
    .toLocaleLowerCase();
}

function mergeHighlights(local: AnalysisHighlight[], remote: AnalysisHighlight[]) {
  const seen = new Set<string>();
  return [...remote, ...local].filter(item => {
    const key = `${item.label}:${item.detail}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

function mergeTimeline(local: TimelineEvent[], remote: TimelineEvent[]) {
  const seen = new Set<string>();
  return [...local, ...remote].filter(item => {
    const key = `${item.when}:${item.what}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
}

function mergeEvidence(local: EvidenceAnalysis[], insight: MultimodalInsight) {
  const remoteByName = new Map<string, MultimodalInsight["evidenceFindings"][number]>();
  for (const finding of insight.evidenceFindings) {
    const name = originalFileName(finding.fileName);
    const key = comparableFileName(name);
    const existing = remoteByName.get(key);
    remoteByName.set(key, existing ? {
      ...existing,
      observations: unique([...existing.observations, ...finding.observations]),
      visibleText: unique([...existing.visibleText, ...finding.visibleText]),
      concerningSignals: unique([...existing.concerningSignals, ...finding.concerningSignals]),
      limitations: unique([...existing.limitations, ...finding.limitations]),
    } : finding);
  }

  return local.map(item => {
    const itemKey = comparableFileName(item.fileName);
    const remote = remoteByName.get(itemKey)
      || [...remoteByName.entries()].find(([key]) => key.endsWith(itemKey) || itemKey.endsWith(key))?.[1];
    const fileLimitations = insight.limitations
      .filter(value => comparableFileName(value.split(":", 1)[0]) === itemKey)
      .map(value => value.slice(value.indexOf(":") + 1).trim());
    if (!remote) return fileLimitations.length ? { ...item, limitations: unique([...fileLimitations, ...item.limitations]) } : item;
    const hasContentFinding = remote.observations.length > 0 || remote.visibleText.length > 0 || remote.concerningSignals.length > 0;
    return {
      fileName: item.fileName,
      status: hasContentFinding ? "AI reviewed" as const : item.status,
      observations: unique([
        ...remote.observations,
        ...remote.visibleText.map(text => `Visible text: ${text}`),
        ...remote.concerningSignals,
        ...item.observations,
      ]),
      limitations: unique([
        ...remote.limitations,
        ...fileLimitations,
        ...item.limitations.filter(value => !hasContentFinding || !value.includes("not been read automatically")),
      ]),
    };
  });
}

export function addLocalEngine(result: AnalysisResult, mediaCount: number, reason?: string): AnalysisResult {
  return {
    ...result,
    engine: {
      mode: "Local fallback",
      label: "Structured text analysis",
      mediaReviewed: 0,
      limitations: [reason || (mediaCount ? "Uploaded media has not been interpreted by the connected analysis pipeline." : "No media was supplied for content review.")],
    },
  };
}

export function mergeMultimodalAnalysis(local: AnalysisResult, insight: MultimodalInsight): AnalysisResult {
  const evidenceAnalysis = mergeEvidence(local.evidenceAnalysis, insight);
  const reviewed = evidenceAnalysis.filter(item => item.status === "AI reviewed").length;
  const checks = local.verification.checks.map(check => check.label === "Evidence content" && reviewed > 0
    ? { ...check, status: "Ready" as const, detail: `${reviewed} attachment${reviewed === 1 ? " was" : "s were"} reviewed by the connected analysis pipeline. Human verification is still required.` }
    : check);
  const verificationPoints = checks.reduce((total, check) => total + (check.status === "Ready" ? 1 : check.status === "Needs review" ? 0.5 : 0), 0);
  const severity = severityRank[insight.severity] > severityRank[local.severity] ? insight.severity : local.severity;

  return {
    ...local,
    summary: insight.situationSummary || local.summary,
    category: insight.category || local.category,
    severity,
    confidence: Math.min(97, Math.max(local.confidence, insight.confidence)),
    aiSuspected: local.aiSuspected || insight.suspectedAiManipulation,
    highlights: mergeHighlights(local.highlights, insight.importantIndicators),
    timeline: mergeTimeline(local.timeline, insight.timeline),
    evidenceAnalysis,
    riskFactors: unique([...local.riskFactors, ...insight.importantIndicators.filter(item => item.level !== "Context").map(item => item.label)]),
    verification: {
      ...local.verification,
      checks,
      readyChecks: checks.filter(check => check.status === "Ready").length,
      readiness: Math.round((verificationPoints / checks.length) * 100),
    },
    engine: {
      mode: "Multimodal AI",
      label: "Context + media analysis",
      model: insight.model,
      mediaReviewed: reviewed,
      limitations: insight.limitations,
    },
    multimodal: insight,
  };
}
