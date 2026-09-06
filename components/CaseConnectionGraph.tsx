"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  Crosshair,
  ExternalLink,
  Fingerprint,
  GitBranch,
  Link2,
  LocateFixed,
  Minus,
  MousePointer2,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import {
  buildPreventionGraph,
  type CaseGraphEdge,
  type CaseGraphNode,
  type PreventionPattern,
  type SignalGraphNode,
} from "@/lib/prevention-graph";

type GraphSelection =
  | { kind: "case"; node: CaseGraphNode }
  | { kind: "signal"; node: SignalGraphNode }
  | { kind: "edge"; edge: CaseGraphEdge };

const date = (value: string) => new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
}).format(new Date(value));

const label = (value: string) => value
  .replaceAll("_", " ")
  .toLowerCase()
  .replace(/\b\w/g, letter => letter.toUpperCase());

function short(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

function statusClass(value: string) {
  return value.toLowerCase().replaceAll("_", "-").replaceAll(" ", "-");
}

function connectionPath(caseNode: CaseGraphNode, signalNode: SignalGraphNode) {
  const fromLeft = caseNode.x < signalNode.x;
  const startX = caseNode.x + (fromLeft ? 98 : -98);
  const endX = signalNode.x + (fromLeft ? -86 : 86);
  const bend = Math.max(52, Math.abs(endX - startX) * 0.48);
  return `M ${startX} ${caseNode.y} C ${startX + (fromLeft ? bend : -bend)} ${caseNode.y}, ${endX + (fromLeft ? -bend : bend)} ${signalNode.y}, ${endX} ${signalNode.y}`;
}

export function CaseConnectionGraph({ patterns }: { patterns: PreventionPattern[] }) {
  const available = patterns.filter(pattern => pattern.supporting_cases?.length && pattern.indicators?.length);
  const [patternId, setPatternId] = useState(available[0]?.id || "");
  const [hoveredKey, setHoveredKey] = useState<string>();
  const [pinnedKey, setPinnedKey] = useState<string>();
  const [zoom, setZoom] = useState(1);
  const [query, setQuery] = useState("");
  const [signalType, setSignalType] = useState("all");
  const [isPanning, setIsPanning] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | undefined>(undefined);
  const pattern = available.find(item => item.id === patternId) || available[0];
  const signalTypes = pattern
    ? Array.from(new Map(pattern.indicators.map(item => [item.type, item.type_label])).entries())
    : [];
  const displayedPattern = pattern
    ? { ...pattern, indicators: signalType === "all" ? pattern.indicators : pattern.indicators.filter(item => item.type === signalType) }
    : undefined;
  const graph = displayedPattern ? buildPreventionGraph(displayedPattern) : undefined;

  const selections = (() => {
    const items = new Map<string, GraphSelection>();
    if (!graph) return items;
    graph.cases.forEach(node => items.set(node.id, { kind: "case", node }));
    graph.signals.forEach(node => items.set(node.id, { kind: "signal", node }));
    graph.edges.forEach(edge => items.set(edge.id, { kind: "edge", edge }));
    return items;
  })();

  if (!pattern || !graph) {
    return <section className="case-network case-network-empty">
      <GitBranch/>
      <div><h2>The case map is ready for its first connection</h2><p>It will appear when two or more cases share an exact, normalized identifier.</p></div>
    </section>;
  }

  const activeKey = hoveredKey || pinnedKey;
  const active = activeKey ? selections.get(activeKey) : undefined;
  const pinned = Boolean(pinnedKey && activeKey === pinnedKey && !hoveredKey);
  const caseByNodeId = new Map(graph.cases.map(node => [node.id, node]));
  const signalByNodeId = new Map(graph.signals.map(node => [node.id, node]));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingCases = new Set(graph.cases.filter(node => !normalizedQuery || [
    node.case.reference,
    node.case.summary,
    node.case.category,
    node.case.status,
  ].some(value => value.toLocaleLowerCase().includes(normalizedQuery))).map(node => node.id));
  const matchingSignals = new Set(graph.signals.filter(node => !normalizedQuery || [
    node.indicator.type_label,
    node.indicator.display_value,
  ].some(value => value.toLocaleLowerCase().includes(normalizedQuery))).map(node => node.id));
  const strongestSignal = graph.signals.reduce<SignalGraphNode | undefined>((strongest, node) =>
    !strongest || node.indicator.case_count > strongest.indicator.case_count ? node : strongest, undefined);

  const pin = (key: string) => setPinnedKey(current => current === key ? undefined : key);
  const keyboardPin = (event: KeyboardEvent<SVGGElement>, key: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pin(key);
    }
    if (event.key === "Escape") {
      setPinnedKey(undefined);
      setHoveredKey(undefined);
    }
  };
  const relatedToActive = (edge: CaseGraphEdge) => !activeKey
    || activeKey === edge.id
    || activeKey === edge.caseNodeId
    || activeKey === edge.signalNodeId;
  const relatedToSearch = (edge: CaseGraphEdge) => !normalizedQuery
    || matchingCases.has(edge.caseNodeId)
    || matchingSignals.has(edge.signalNodeId);
  const beginPan = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    if ((event.target as Element).closest(".network-node,.network-edge")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    pan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: canvas.scrollLeft, top: canvas.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsPanning(true);
  };
  const movePan = (event: PointerEvent<HTMLDivElement>) => {
    const origin = pan.current;
    const canvas = canvasRef.current;
    if (!origin || !canvas || origin.pointerId !== event.pointerId) return;
    canvas.scrollLeft = origin.left - (event.clientX - origin.x);
    canvas.scrollTop = origin.top - (event.clientY - origin.y);
  };
  const endPan = (event: PointerEvent<HTMLDivElement>) => {
    if (pan.current?.pointerId !== event.pointerId) return;
    pan.current = undefined;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setIsPanning(false);
  };

  return <section className="case-network" aria-labelledby="case-network-title">
    <header className="case-network-heading">
      <div>
        <span className="connect-label"><GitBranch/>Connection map</span>
        <h2 id="case-network-title">See how reports connect through evidence</h2>
        <p>Cases never connect by visual proximity. Every line below points to an exact identifier found in that report.</p>
      </div>
      <div className="case-network-legend" aria-label="Map legend">
        <span><i className="legend-case"/>Case</span>
        <span><i className="legend-signal"/>Shared signal</span>
        <span><i className="legend-line"/>Exact match</span>
      </div>
    </header>

    <div className="case-network-toolbar">
      <label>
        <span>Pattern to explore</span>
        <select value={pattern.id} onChange={event => {
          setPatternId(event.target.value);
          setPinnedKey(undefined);
          setHoveredKey(undefined);
          setZoom(1);
          setQuery("");
          setSignalType("all");
        }}>
          {available.map(item => <option key={item.id} value={item.id}>{item.title} · {item.complaint_count} cases</option>)}
        </select>
      </label>
      <div className="case-network-counts" aria-live="polite">
        <span><strong>{graph.cases.length}</strong> cases</span>
        <span><strong>{graph.signals.length}</strong> signals</span>
        <span><strong>{graph.edges.length}</strong> evidenced links</span>
      </div>
      <div className="case-network-zoom" aria-label="Map zoom controls">
        <button type="button" onClick={() => setZoom(value => Math.max(.8, value - .1))} disabled={zoom <= .8} aria-label="Zoom out"><Minus/></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(value => Math.min(1.5, value + .1))} disabled={zoom >= 1.5} aria-label="Zoom in"><Plus/></button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Fit map"><Crosshair/></button>
      </div>
    </div>

    <div className="case-network-filterbar">
      <label className="case-network-search">
        <Search/>
        <span className="sr-only">Search cases and signals</span>
        <input
          value={query}
          placeholder="Find a case, category or identifier"
          onChange={event => { setQuery(event.target.value); setPinnedKey(undefined); }}
          onKeyDown={event => {
            if (event.key !== "Enter") return;
            const firstMatch = graph.cases.find(node => matchingCases.has(node.id))?.id
              || graph.signals.find(node => matchingSignals.has(node.id))?.id;
            if (firstMatch) setPinnedKey(firstMatch);
          }}
        />
        {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear graph search"><X/></button>}
      </label>
      <div className="case-network-signal-filters" role="group" aria-label="Filter graph by signal type">
        <button type="button" className={signalType === "all" ? "active" : ""} onClick={() => { setSignalType("all"); setPinnedKey(undefined); }}>All signals</button>
        {signalTypes.map(([type, typeLabel]) => <button type="button" key={type} className={signalType === type ? "active" : ""} onClick={() => { setSignalType(type); setPinnedKey(undefined); }}>{typeLabel}</button>)}
      </div>
      {strongestSignal && <button className="case-network-strongest" type="button" onClick={() => setPinnedKey(strongestSignal.id)}><LocateFixed/>Trace strongest signal</button>}
      {normalizedQuery && <span className="case-network-match-count" aria-live="polite">{matchingCases.size + matchingSignals.size} direct match{matchingCases.size + matchingSignals.size === 1 ? "" : "es"}</span>}
    </div>

    <div className="case-network-workspace">
      <div
        ref={canvasRef}
        className={`case-network-canvas ${isPanning ? "is-panning" : ""}`}
        role="region"
        aria-label={`Interactive map for ${pattern.title}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        <svg
          viewBox={`0 0 ${graph.width} ${graph.height}`}
          style={{ width: `${zoom * 100}%` }}
          role="group"
          aria-labelledby="case-network-svg-title case-network-svg-description"
        >
          <title id="case-network-svg-title">{pattern.title} case connection map</title>
          <desc id="case-network-svg-description">Tab through case nodes, shared signal nodes, and their connecting lines. Enter or Space pins details.</desc>
          <defs>
            <pattern id="network-grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#c8dbd5"/>
            </pattern>
          </defs>
          <rect width={graph.width} height={graph.height} fill="url(#network-grid)"/>
          <g className="network-edges">
            {graph.edges.map(edge => {
              const caseNode = caseByNodeId.get(edge.caseNodeId);
              const signalNode = signalByNodeId.get(edge.signalNodeId);
              if (!caseNode || !signalNode) return null;
              const path = connectionPath(caseNode, signalNode);
              const isActive = activeKey === edge.id;
              const isRelated = relatedToActive(edge) && relatedToSearch(edge);
              const accessibleLabel = `${edge.case.reference} contains the exact ${edge.indicator.type_label} ${edge.indicator.display_value}. Source: ${edge.sources.join(", ")}.`;
              return <g
                key={edge.id}
                className={`network-edge ${isActive ? "active" : ""} ${!isRelated ? "dimmed" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={accessibleLabel}
                aria-describedby={isActive ? "case-network-detail" : undefined}
                onPointerEnter={() => setHoveredKey(edge.id)}
                onPointerLeave={() => setHoveredKey(undefined)}
                onFocus={() => setHoveredKey(edge.id)}
                onBlur={() => setHoveredKey(undefined)}
                onClick={() => pin(edge.id)}
                onKeyDown={event => keyboardPin(event, edge.id)}
              >
                <path className="network-edge-visible" d={path}/>
                <path className="network-edge-hit" d={path}/>
                <circle cx={signalNode.x + (caseNode.x < signalNode.x ? -86 : 86)} cy={signalNode.y} r="3.5"/>
              </g>;
            })}
          </g>
          <g className="network-nodes">
            {graph.cases.map(node => {
              const connected = graph.edges.some(edge => edge.caseNodeId === node.id && relatedToActive(edge));
              const searchRelated = !normalizedQuery || matchingCases.has(node.id) || graph.edges.some(edge => edge.caseNodeId === node.id && matchingSignals.has(edge.signalNodeId));
              const isActive = activeKey === node.id;
              const visibleConnectionCount = graph.edges.filter(edge => edge.caseNodeId === node.id).length;
              return <g
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                className={`network-node network-case-node ${isActive ? "active" : ""} ${matchingCases.has(node.id) && normalizedQuery ? "search-match" : ""} ${(activeKey && !connected && !isActive) || !searchRelated || (signalType !== "all" && visibleConnectionCount === 0) ? "dimmed" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${node.case.reference}. ${node.case.category}. ${node.case.status}. ${node.connectionCount} shared signals.`}
                aria-describedby={isActive ? "case-network-detail" : undefined}
                onPointerEnter={() => setHoveredKey(node.id)}
                onPointerLeave={() => setHoveredKey(undefined)}
                onFocus={() => setHoveredKey(node.id)}
                onBlur={() => setHoveredKey(undefined)}
                onClick={() => pin(node.id)}
                onKeyDown={event => keyboardPin(event, node.id)}
              >
                <rect x="-98" y="-38" width="196" height="76" rx="12"/>
                <circle className={`case-status-dot ${statusClass(node.case.status)}`} cx="-78" cy="-17" r="4"/>
                <text className="network-case-reference" x="-67" y="-13">{short(node.case.reference, 23)}</text>
                <text className="network-case-category" x="-78" y="9">{short(node.case.category, 30)}</text>
                <text className="network-case-meta" x="-78" y="27">{visibleConnectionCount} visible signal{visibleConnectionCount === 1 ? "" : "s"}</text>
              </g>;
            })}
            {graph.signals.map(node => {
              const connected = graph.edges.some(edge => edge.signalNodeId === node.id && relatedToActive(edge));
              const searchRelated = !normalizedQuery || matchingSignals.has(node.id) || graph.edges.some(edge => edge.signalNodeId === node.id && matchingCases.has(edge.caseNodeId));
              const isActive = activeKey === node.id;
              return <g
                key={node.id}
                transform={`translate(${node.x} ${node.y})`}
                className={`network-node network-signal-node ${isActive ? "active" : ""} ${matchingSignals.has(node.id) && normalizedQuery ? "search-match" : ""} ${(activeKey && !connected && !isActive) || !searchRelated ? "dimmed" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${node.indicator.type_label} ${node.indicator.display_value}, observed in ${node.indicator.case_count} cases.`}
                aria-describedby={isActive ? "case-network-detail" : undefined}
                onPointerEnter={() => setHoveredKey(node.id)}
                onPointerLeave={() => setHoveredKey(undefined)}
                onFocus={() => setHoveredKey(node.id)}
                onBlur={() => setHoveredKey(undefined)}
                onClick={() => pin(node.id)}
                onKeyDown={event => keyboardPin(event, node.id)}
              >
                <rect x="-86" y="-29" width="172" height="58" rx="29"/>
                <circle cx="-65" cy="0" r="11"/>
                <path d="M -70 -2 h 10 M -70 2 h 10 M -67 -6 v 12"/>
                <text className="network-signal-type" x="-46" y="-4">{node.indicator.type_label}</text>
                <text className="network-signal-value" x="-46" y="13">{short(node.indicator.display_value, 22)}</text>
              </g>;
            })}
          </g>
        </svg>
        {normalizedQuery && matchingCases.size + matchingSignals.size === 0 && <div className="case-network-no-results">No case or signal matches “{query.trim()}”.</div>}
        <div className="case-network-hint"><MousePointer2/>Hover, focus or drag the map. Click to pin a trail.</div>
      </div>

      <aside className={`case-network-detail ${active ? "has-selection" : ""}`} id="case-network-detail" aria-live="polite">
        <GraphDetail active={active} pattern={pattern} pinned={pinned}/>
      </aside>
    </div>

    <footer className="case-network-boundary"><AlertTriangle/><span><strong>Potential connections, not conclusions.</strong> Shared identifiers can be reused, spoofed or controlled by more than one person. A reviewer must inspect the underlying evidence.</span></footer>
  </section>;
}

function GraphDetail({ active, pattern, pinned }: { active?: GraphSelection; pattern: PreventionPattern; pinned: boolean }) {
  if (!active) return <div className="network-detail-default">
    <div className="network-detail-icon"><GitBranch/></div>
    <span className={`pattern-state ${statusClass(pattern.status)}`}>{label(pattern.status)}</span>
    <h3>{pattern.title}</h3>
    <p>{pattern.complaint_count} cases are grouped by exact recurring identifiers.</p>
    <div className="network-detail-summary">
      <span><strong>{date(pattern.first_seen)}</strong>First observed</span>
      <span><strong>{date(pattern.last_seen)}</strong>Latest observed</span>
    </div>
    <small>Choose a case, signal or line to inspect its evidence.</small>
  </div>;

  if (active.kind === "case") {
    const item = active.node;
    return <div>
      <div className="network-detail-top"><span>Case detail</span>{pinned && <em>Pinned</em>}</div>
      <h3>{item.case.reference}</h3>
      <p>{item.case.summary}</p>
      <dl>
        <div><dt>Status</dt><dd>{item.case.status}</dd></div>
        <div><dt>Category</dt><dd>{item.case.category}</dd></div>
        <div><dt>Recorded</dt><dd><CalendarDays/>{date(item.case.created_at)}</dd></div>
        <div><dt>Connections</dt><dd><Link2/>{item.connectionCount} exact signal{item.connectionCount === 1 ? "" : "s"}</dd></div>
      </dl>
      <Link className="network-detail-link" href={`/cases/${encodeURIComponent(item.case.id)}`}>Open full case <ExternalLink/></Link>
    </div>;
  }

  if (active.kind === "signal") {
    const item = active.node.indicator;
    return <div>
      <div className="network-detail-top"><span>Shared signal</span>{pinned && <em>Pinned</em>}</div>
      <Fingerprint className="network-detail-watermark"/>
      <h3 translate="no">{item.display_value}</h3>
      <p>This exact normalized {item.type_label.toLowerCase()} appears in {item.case_count} supporting cases.</p>
      <dl><div><dt>Signal type</dt><dd>{item.type_label}</dd></div><div><dt>Source trail</dt><dd>{item.sources.join(", ")}</dd></div></dl>
      <small>Matching is deterministic after type-specific normalization; the value is not proof of common control.</small>
    </div>;
  }

  const { edge } = active;
  return <div>
    <div className="network-detail-top"><span>Why this line exists</span>{pinned && <em>Pinned</em>}</div>
    <div className="network-link-route"><span>{edge.case.reference}</span><i/><span translate="no">{edge.indicator.display_value}</span></div>
    <h3>Exact {edge.indicator.type_label.toLowerCase()} match</h3>
    <p>The case contains this normalized identifier, which also appears in {edge.indicator.case_count - 1} other supporting case{edge.indicator.case_count === 2 ? "" : "s"}.</p>
    <dl><div><dt>Matched value</dt><dd translate="no">{edge.indicator.display_value}</dd></div><div><dt>Source in this case</dt><dd>{edge.sources.join(", ")}</dd></div></dl>
    <div className="network-evidence-note"><ShieldCheck/><span>The line records an evidence match only. It does not identify an offender.</span></div>
  </div>;
}
