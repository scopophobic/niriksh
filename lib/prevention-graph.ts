export interface PreventionCase {
  id: string;
  reference: string;
  summary: string;
  category: string;
  status: string;
  created_at: string;
}

export interface PreventionIndicator {
  type: string;
  type_label: string;
  display_value: string;
  normalized_value?: string;
  case_count: number;
  case_ids?: string[];
  case_sources?: Record<string, string[]>;
  sources: string[];
}

export interface PreventionPattern {
  id: string;
  title: string;
  status: string;
  behavioural_pattern?: string;
  complaint_count: number;
  first_seen: string;
  last_seen: string;
  indicators: PreventionIndicator[];
  supporting_cases: PreventionCase[];
  reasons: string[];
}

export interface CaseGraphNode {
  id: string;
  kind: "case";
  x: number;
  y: number;
  connectionCount: number;
  case: PreventionCase;
}

export interface SignalGraphNode {
  id: string;
  kind: "signal";
  x: number;
  y: number;
  indicator: PreventionIndicator;
}

export interface CaseGraphEdge {
  id: string;
  caseNodeId: string;
  signalNodeId: string;
  case: PreventionCase;
  indicator: PreventionIndicator;
  sources: string[];
}

export interface PreventionGraphModel {
  width: number;
  height: number;
  cases: CaseGraphNode[];
  signals: SignalGraphNode[];
  edges: CaseGraphEdge[];
}

const GRAPH_WIDTH = 920;
const MIN_GRAPH_HEIGHT = 560;

function spread(index: number, count: number, height: number) {
  if (count <= 1) return height / 2;
  const top = 76;
  const bottom = height - 76;
  return top + (index * (bottom - top)) / (count - 1);
}

export function buildPreventionGraph(pattern: PreventionPattern): PreventionGraphModel {
  const sortedCases = [...pattern.supporting_cases].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || a.reference.localeCompare(b.reference),
  );
  const leftCount = Math.ceil(sortedCases.length / 2);
  const rightCount = sortedCases.length - leftCount;
  const graphHeight = Math.max(
    MIN_GRAPH_HEIGHT,
    leftCount * 104 + 96,
    pattern.indicators.length * 82 + 96,
  );

  const caseNodes: CaseGraphNode[] = sortedCases.map((item, index) => {
    const onLeft = index < leftCount;
    const columnIndex = onLeft ? index : index - leftCount;
    const columnCount = onLeft ? leftCount : rightCount;
    return {
      id: `case:${item.id}`,
      kind: "case",
      x: onLeft ? 126 : GRAPH_WIDTH - 126,
      y: spread(columnIndex, columnCount, graphHeight),
      connectionCount: 0,
      case: item,
    };
  });

  const signalNodes: SignalGraphNode[] = pattern.indicators.map((indicator, index) => ({
    id: `signal:${pattern.id}:${indicator.type}:${indicator.normalized_value || indicator.display_value}`,
    kind: "signal",
    x: GRAPH_WIDTH / 2,
    y: spread(index, pattern.indicators.length, graphHeight),
    indicator,
  }));

  const casesById = new Map(caseNodes.map(node => [node.case.id, node]));
  const edges: CaseGraphEdge[] = [];
  for (const signal of signalNodes) {
    // Old stored patterns may not yet carry case_ids. Only infer membership when the
    // signal count covers the whole cluster, avoiding a visually invented link.
    const connectedIds = signal.indicator.case_ids
      || (signal.indicator.case_count >= sortedCases.length ? sortedCases.map(item => item.id) : []);
    for (const caseId of connectedIds) {
      const caseNode = casesById.get(caseId);
      if (!caseNode) continue;
      caseNode.connectionCount += 1;
      edges.push({
        id: `edge:${caseNode.id}:${signal.id}`,
        caseNodeId: caseNode.id,
        signalNodeId: signal.id,
        case: caseNode.case,
        indicator: signal.indicator,
        sources: signal.indicator.case_sources?.[caseId] || signal.indicator.sources,
      });
    }
  }

  return { width: GRAPH_WIDTH, height: graphHeight, cases: caseNodes, signals: signalNodes, edges };
}
