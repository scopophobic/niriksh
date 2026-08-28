"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BrainCircuit, CheckCircle2, ChevronRight, Clock3, FileCheck2, FolderOpen, Plus, Route, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useCaseStore } from "@/lib/case-store";
import { SeverityBadge } from "./SeverityBadge";

export function Dashboard() {
  const { cases } = useCaseStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const visible = useMemo(() => cases.filter(item => {
    const query = search.toLowerCase();
    const matchesSearch = !query || `${item.reference} ${item.summary} ${item.category}`.toLowerCase().includes(query);
    const matchesFilter = filter === "All" || (filter === "Needs attention" && ["Critical", "High"].includes(item.severity)) || (filter === "Needs more information" && item.status === "Needs information");
    return matchesSearch && matchesFilter;
  }), [cases, filter, search]);
  const urgent = cases.filter(item => ["Critical", "High"].includes(item.severity)).length;
  const withEvidence = cases.filter(item => item.evidence.length > 0).length;
  const needsInformation = cases.filter(item => item.status === "Needs information").length;
  const timelinesBuilt = cases.filter(item => item.analysisDetails?.timeline.length).length;
  const sourcedFacts = cases.reduce((total, item) => total + (item.analysisDetails?.facts.length || 0), 0);

  return (
    <div className="page dashboard-page product-dashboard">
      <section className="page-heading product-heading">
        <div><div className="eyebrow">EVIDENCE WORKSPACE</div><h1>Overview</h1><p>Understand complaints, organise evidence and prepare clear cases for review.</p></div>
        <div className="heading-actions"><Link className="button button-ghost" href="/routing"><Route size={16}/> Routing dashboard</Link><Link className="button button-primary" href="/report"><Plus size={17}/> New analysis</Link></div>
      </section>

      <section className="metric-grid product-metrics">
        <div className="metric-card"><span className="metric-icon blue"><FolderOpen size={20}/></span><div><span>Total cases</span><strong>{cases.length}</strong><small>Available in this workspace</small></div></div>
        <div className="metric-card"><span className="metric-icon red"><AlertTriangle size={20}/></span><div><span>Need quick review</span><strong>{urgent}</strong><small>High or critical review order</small></div></div>
        <div className="metric-card"><span className="metric-icon green"><FileCheck2 size={20}/></span><div><span>Include evidence</span><strong>{withEvidence}</strong><small>At least one file attached</small></div></div>
        <div className="metric-card"><span className="metric-icon coral"><Search size={20}/></span><div><span>Need more detail</span><strong>{needsInformation}</strong><small>Waiting for useful context</small></div></div>
      </section>

      <div className="workspace-overview-grid">
      <section className="queue-panel overview-cases">
        <div className="overview-panel-title"><div><h2>Case review</h2><p>Open any case to inspect its context, timeline, sources and files.</p></div><span>{visible.length} shown</span></div>
        <div className="simple-queue-head">
          <div className="search-box"><Search size={17}/><input aria-label="Search cases" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search cases…"/></div>
          <div className="simple-filter-tabs">{["All", "Needs attention", "Needs more information"].map(item => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>
        </div>
        <div className="case-table-wrap">
          <table className="case-table simple-case-table">
            <thead><tr><th>CASE</th><th>WHAT WAS REPORTED</th><th>MAY INVOLVE</th><th>REVIEW ORDER</th><th>FILES</th><th></th></tr></thead>
            <tbody>{visible.map(item => <tr key={item.id}>
              <td><Link href={`/cases/${item.id}`} className="case-ref">{item.reference}</Link><span className="time"><Clock3 size={12}/>{item.createdLabel}</span></td>
              <td><Link href={`/cases/${item.id}`} className="case-summary">{item.summary}</Link></td>
              <td><strong className="category">{item.category}</strong></td>
              <td><SeverityBadge level={item.severity}/></td>
              <td><strong className="simple-file-count">{item.evidence.length}</strong></td>
              <td><Link href={`/cases/${item.id}`} className="row-link" aria-label={`Open ${item.reference}`}><ChevronRight size={19}/></Link></td>
            </tr>)}</tbody>
          </table>
          {visible.length === 0 && <div className="empty-state"><Search size={30}/><h3>No matching cases</h3><p>Try a different search or filter.</p></div>}
        </div>
        <div className="table-footer"><span>Showing {visible.length} of {cases.length} cases</span><span>Every result requires human review</span></div>
      </section>

      <aside className="analysis-engine-card">
        <div className="engine-card-head"><span><BrainCircuit size={18}/></span><div><small>ANALYSIS ENGINE</small><h2>Explainable context analysis</h2></div><i/></div>
        <p>The current engine reads complaint text, readable evidence text and user notes as separate sources.</p>
        <div className="engine-numbers"><div><strong>{cases.length}</strong><span>case analyses</span></div><div><strong>{timelinesBuilt}</strong><span>timelines built</span></div><div><strong>{sourcedFacts}</strong><span>sourced details</span></div></div>
        <div className="engine-checks"><span><CheckCircle2 size={14}/> Understands who, what and whether it is ongoing</span><span><CheckCircle2 size={14}/> Connects details to their source</span><span><CheckCircle2 size={14}/> Finds conflicting statements</span><span><CheckCircle2 size={14}/> Asks for missing context</span></div>
        <Link href="/routing">Open routing dashboard <ArrowRight size={15}/></Link>
        <small className="engine-boundary">OCR, audio transcription and video analysis are shown as upcoming capabilities—not current results.</small>
      </aside>
      </div>
    </div>
  );
}
