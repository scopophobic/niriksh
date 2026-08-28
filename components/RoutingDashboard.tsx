"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Filter,
  Landmark,
  MapPin,
  Plus,
  Route,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useCaseStore } from "@/lib/case-store";
import { SeverityBadge } from "./SeverityBadge";

type RoutingFilter = "All" | "Ready" | "Needs information" | "Manipulated media";

export function RoutingDashboard() {
  const { cases } = useCaseStore();
  const [filter, setFilter] = useState<RoutingFilter>("All");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => cases.map(item => ({
    item,
    routing: item.analysisDetails?.routing,
    verification: item.analysisDetails?.verification,
    takedown: item.analysisDetails?.takedown,
  })), [cases]);
  const ready = rows.filter(row => row.routing?.status === "Ready for human routing").length;
  const needsInformation = rows.filter(row => row.routing?.status !== "Ready for human routing").length;
  const urgent = rows.filter(row => ["Critical", "High"].includes(row.item.severity)).length;
  const contentSafety = rows.filter(row => row.takedown?.recommended).length;
  const actFirst = rows.find(row => row.routing?.status === "Ready for human routing" && ["Critical", "High"].includes(row.item.severity));
  const unitCounts = rows.reduce<Record<string, number>>((counts, row) => {
    const unit = row.routing?.primaryUnit || "General Cybercrime";
    counts[unit] = (counts[unit] || 0) + 1;
    return counts;
  }, {});
  const commonUnit = Object.entries(unitCounts).sort((a, b) => b[1] - a[1])[0];
  const visible = rows.filter(row => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${row.item.reference} ${row.item.summary} ${row.item.category} ${row.routing?.primaryUnit || ""} ${row.routing?.jurisdiction || ""}`.toLowerCase().includes(query);
    const matchesFilter = filter === "All"
      || (filter === "Ready" && row.routing?.status === "Ready for human routing")
      || (filter === "Needs information" && row.routing?.status !== "Ready for human routing")
      || (filter === "Manipulated media" && row.item.aiSuspected);
    return matchesSearch && matchesFilter;
  });

  return <div className="page routing-dashboard-page">
    <section className="page-heading product-heading routing-page-heading">
      <div><div className="eyebrow">HUMAN ROUTING WORKSPACE</div><h1>Routing dashboard</h1><p>See where each analysed complaint may need review and what information is still missing.</p></div>
      <Link className="button button-primary" href="/report"><Plus size={17}/> New complaint</Link>
    </section>

    <section className="metric-grid routing-metrics">
      <div className="metric-card"><span className="metric-icon green"><Route size={20}/></span><div><span>Ready to confirm</span><strong>{ready}</strong><small>Enough context for human routing</small></div></div>
      <div className="metric-card"><span className="metric-icon coral"><FileWarning size={20}/></span><div><span>Need information</span><strong>{needsInformation}</strong><small>Jurisdiction or context is incomplete</small></div></div>
      <div className="metric-card"><span className="metric-icon red"><AlertTriangle size={20}/></span><div><span>Quick review</span><strong>{urgent}</strong><small>High or critical priority</small></div></div>
      <div className="metric-card"><span className="metric-icon blue"><ShieldCheck size={20}/></span><div><span>Preservation guidance</span><strong>{contentSafety}</strong><small>Evidence or takedown steps available</small></div></div>
    </section>

    <section className="routing-focus-grid">
      <article className="routing-focus-card urgent"><span><AlertTriangle size={18}/></span><div><small>ACT FIRST</small><strong>{actFirst ? actFirst.item.reference : "No urgent ready case"}</strong><p>{actFirst ? `${actFirst.item.severity} priority · ${actFirst.routing?.primaryUnit}` : "Urgent cases still need information or review."}</p></div>{actFirst && <Link href={`/cases/${actFirst.item.id}`}>Review <ArrowRight size={14}/></Link>}</article>
      <article className="routing-focus-card"><span><Landmark size={18}/></span><div><small>BUSIEST DESTINATION</small><strong>{commonUnit?.[0] || "No destination yet"}</strong><p>{commonUnit ? `${commonUnit[1]} case${commonUnit[1] === 1 ? "" : "s"} currently recommended` : "Routes appear after analysis."}</p></div></article>
      <article className="routing-focus-card"><span><ClipboardCheck size={18}/></span><div><small>QUEUE BLOCKERS</small><strong>{needsInformation} need follow-up</strong><p>Open a case to see the exact missing detail before routing.</p></div></article>
    </section>

    <div className="routing-dashboard-layout">
      <section className="queue-panel routing-queue">
        <div className="routing-queue-head"><div><h2>Routing recommendations</h2><p>Recommendations are derived from category, priority, jurisdiction and specialist-review needs.</p></div><span>{visible.length} cases</span></div>
        <div className="routing-toolbar">
          <div className="search-box"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search case, unit or location…" aria-label="Search routing cases"/></div>
          <div className="routing-filter"><Filter size={14}/>{(["All", "Ready", "Needs information", "Manipulated media"] as RoutingFilter[]).map(item => <button className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div>
        </div>
        <div className="routing-table-wrap">
          <table className="routing-table">
            <thead><tr><th>CASE</th><th>PRIORITY</th><th>RECOMMENDED UNIT</th><th>JURISDICTION</th><th>READINESS</th><th>NEXT ACTION</th><th/></tr></thead>
            <tbody>{visible.map(({ item, routing, verification }) => {
              const routeReady = routing?.status === "Ready for human routing";
              const nextAction = routeReady ? (["Critical", "High"].includes(item.severity) ? "Confirm urgent route" : "Confirm destination") : `Collect: ${item.missing[0] || "jurisdiction details"}`;
              return <tr key={item.id}>
              <td><Link href={`/cases/${item.id}`} className="case-ref">{item.reference}</Link><span className="time"><Clock3 size={11}/>{item.createdLabel}</span></td>
              <td><SeverityBadge level={item.severity}/></td>
              <td><span className="route-unit"><Landmark size={14}/><strong>{routing?.primaryUnit || "General Cybercrime"}</strong></span></td>
              <td><span className="route-jurisdiction"><MapPin size={13}/>{routing?.jurisdiction || item.location || "Not provided"}</span></td>
              <td><span className="route-verification"><b>{verification?.readiness || 0}%</b><i><em style={{ width: `${verification?.readiness || 0}%` }}/></i></span></td>
              <td><span className={`route-next-action ${routeReady ? "ready" : "missing"}`}>{routeReady ? <CheckCircle2 size={12}/> : <CircleHelp size={12}/>} {nextAction}</span></td>
              <td><Link className="row-link" href={`/cases/${item.id}`} aria-label={`Review ${item.reference}`}><ChevronRight size={18}/></Link></td>
            </tr>; })}</tbody>
          </table>
          {visible.length === 0 && <div className="empty-state"><Search size={28}/><h3>No routing cases match</h3><p>Try another search or filter.</p></div>}
        </div>
      </section>

      <aside className="routing-policy-card">
        <span><ShieldCheck size={20}/></span><small>HUMAN ROUTING CHECK</small><h2>Confirm before sending</h2><p>The page recommends a destination from the supplied facts. Nothing is dispatched automatically.</p>
        <div><strong>Before confirming</strong><span><i>1</i>Open the evidence and priority</span><span><i>2</i>Verify State, district and police station</span><span><i>3</i>Check the recommended specialist unit</span><span><i>4</i>Collect any missing information</span></div>
        <Link href="/dashboard">Open evidence workspace <ArrowRight size={14}/></Link>
      </aside>
    </div>
  </div>;
}
