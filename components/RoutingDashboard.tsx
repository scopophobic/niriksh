"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, CircleHelp, Clock3, FileWarning, Filter, FolderOpen, Landmark, MapPin, Plus, Route, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useCaseStore } from "@/lib/case-store";
import { REVIEW_CATEGORIES } from "@/lib/review-policy";

export function RoutingDashboard() {
  const { cases } = useCaseStore();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => cases.map(item => ({ item, routing: item.analysisDetails?.routing, verification: item.analysisDetails?.verification })), [cases]);
  const ready = rows.filter(row => row.routing?.status === "Ready for human routing").length;
  const needsInformation = rows.length - ready;
  const folderCounts = REVIEW_CATEGORIES.map(category => ({ ...category, count: rows.filter(row => row.item.reviewCategory === category.id).length }));
  const visible = rows.filter(row => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${row.item.reference} ${row.item.summary} ${row.item.category} ${row.routing?.primaryUnit || ""} ${row.routing?.jurisdiction || ""}`.toLowerCase().includes(query);
    const matchesFilter = filter === "All" || row.item.reviewCategory === filter || (filter === "needs-information" && row.routing?.status !== "Ready for human routing");
    return matchesSearch && matchesFilter;
  });

  return <div className="page routing-dashboard-page">
    <section className="page-heading product-heading routing-page-heading">
      <div><div className="eyebrow">HUMAN CATEGORY WORKSPACE</div><h1>Subject folders</h1><p>Review cases by the category selected during intake. Received order is preserved; Niriksh does not generate a priority queue.</p></div>
      <Link className="button button-primary" href="/report"><Plus size={17}/> New complaint</Link>
    </section>

    <section className="metric-grid routing-metrics">
      <div className="metric-card"><span className="metric-icon green"><Route size={20}/></span><div><span>Ready to confirm</span><strong>{ready}</strong><small>Enough information for a human decision</small></div></div>
      <div className="metric-card"><span className="metric-icon coral"><FileWarning size={20}/></span><div><span>Need information</span><strong>{needsInformation}</strong><small>Location or context is incomplete</small></div></div>
      <div className="metric-card"><span className="metric-icon red"><FolderOpen size={20}/></span><div><span>Subject folders</span><strong>{folderCounts.filter(item => item.count).length}</strong><small>Categories represented in the inbox</small></div></div>
      <div className="metric-card"><span className="metric-icon blue"><ShieldCheck size={20}/></span><div><span>Decision policy</span><strong>Human</strong><small>No automated priority or routing</small></div></div>
    </section>

    <section className="routing-focus-grid">
      {folderCounts.filter(item => item.count).slice(0, 3).map(folder => <article className="routing-focus-card" key={folder.id}><span><Landmark size={18}/></span><div><small>{folder.label}</small><strong>{folder.count} case{folder.count === 1 ? "" : "s"}</strong><p>{folder.team}</p></div><button onClick={() => setFilter(folder.id)}>Open folder <ArrowRight size={14}/></button></article>)}
    </section>

    <div className="routing-dashboard-layout">
      <section className="queue-panel routing-queue">
        <div className="routing-queue-head"><div><h2>Human review inbox</h2><p>Subject folders organise work; an authorised officer confirms or changes the destination.</p></div><span>{visible.length} cases</span></div>
        <div className="routing-toolbar">
          <div className="search-box"><Search size={16}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search case, folder or location…" aria-label="Search cases"/></div>
          <div className="routing-filter"><Filter size={14}/><button className={filter === "All" ? "active" : ""} onClick={() => setFilter("All")}>All</button>{REVIEW_CATEGORIES.map(item => <button className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)} key={item.id}>{item.label}</button>)}<button className={filter === "needs-information" ? "active" : ""} onClick={() => setFilter("needs-information")}>Needs information</button></div>
        </div>
        <div className="routing-table-wrap">
          <table className="routing-table">
            <thead><tr><th>CASE</th><th>SUBJECT FOLDER</th><th>PROPOSED TEAM</th><th>JURISDICTION</th><th>DETAILS READY</th><th>NEXT HUMAN ACTION</th><th/></tr></thead>
            <tbody>{visible.map(({ item, routing, verification }) => {
              const routeReady = routing?.status === "Ready for human routing";
              return <tr key={item.id}>
                <td><Link href={`/cases/${item.id}`} className="case-ref">{item.reference}</Link><span className="time"><Clock3 size={11}/>{item.createdLabel}</span></td>
                <td><strong>{item.category}</strong></td>
                <td><span className="route-unit"><Landmark size={14}/><strong>{routing?.primaryUnit || item.department[0]}</strong></span></td>
                <td><span className="route-jurisdiction"><MapPin size={13}/>{routing?.jurisdiction || item.location || "Not provided"}</span></td>
                <td><span className="route-verification"><b>{verification?.readiness || 0}%</b><i><em style={{ width: `${verification?.readiness || 0}%` }}/></i></span></td>
                <td><span className={`route-next-action ${routeReady ? "ready" : "missing"}`}>{routeReady ? <CheckCircle2 size={12}/> : <CircleHelp size={12}/>} {routeReady ? "Officer confirms team" : `Collect: ${item.missing[0] || "jurisdiction details"}`}</span></td>
                <td><Link className="row-link" href={`/cases/${item.id}`} aria-label={`Review ${item.reference}`}><ChevronRight size={18}/></Link></td>
              </tr>;
            })}</tbody>
          </table>
          {visible.length === 0 && <div className="empty-state"><Search size={28}/><h3>No cases match</h3><p>Try another search or subject folder.</p></div>}
        </div>
      </section>

      <aside className="routing-policy-card">
        <span><ShieldCheck size={20}/></span><small>HUMAN DECISION CHECK</small><h2>Confirm before sending</h2><p>The intake folder is not a legal classification or routing decision. Nothing is dispatched automatically.</p>
        <div><strong>Before confirming</strong><span><i>1</i>Read the complaint and source evidence</span><span><i>2</i>Verify State, district and police station</span><span><i>3</i>Confirm or change the subject folder</span><span><i>4</i>Record the destination and reason</span></div>
        <Link href="/dashboard">Open evidence workspace <ArrowRight size={14}/></Link>
      </aside>
    </div>
  </div>;
}
