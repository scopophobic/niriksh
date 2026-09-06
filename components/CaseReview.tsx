"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowLeft, CheckCircle2, CircleHelp, FileSearch, FileText,
  Image as ImageIcon, Info, Link2, MapPin, Paperclip, ShieldCheck, Video,
} from "lucide-react";
import { useCaseStore } from "@/lib/case-store";
import { caseIndicators, evidenceAnchor, missingInformation, sourceEvidenceName } from "@/lib/case-intelligence";
import { EvidenceItem } from "@/lib/types";
import { RelatedIncidents } from "./RelatedIncidents";
import { PreventionWarning } from "./PreventionWarning";

function SourceTrace({ source }: { source: string }) {
  const evidenceName = sourceEvidenceName(source);
  const href = evidenceName
    ? `#${evidenceAnchor(evidenceName)}`
    : /user description|reporter narrative/i.test(source)
      ? "#original-narrative"
      : /^form:/i.test(source)
        ? "#intake-details"
        : undefined;
  const content = <><Link2/>Source → {source}</>;
  return href ? <a className="source-link" href={href}>{content}</a> : <span className="source-link">{content}</span>;
}

export function CaseReview({ id }: { id: string }) {
  const { getCase } = useCaseStore();
  const item = getCase(id);
  if (!item) return <div className="not-found"><AlertTriangle size={34}/><h1>Case not found</h1><p>This case may have been cleared when the demo was reset.</p><Link className="button button-primary" href="/dashboard">Return to cases</Link></div>;

  const details = item.analysisDetails;
  const indicators = caseIndicators(item);
  const location = [item.complaintDetails?.policeStation, item.complaintDetails?.district, item.complaintDetails?.state].filter(Boolean).join(", ") || item.location;
  const signals = details?.highlights || [];

  return <div className="page case-folio">
    <div className="breadcrumbs"><Link href="/dashboard"><ArrowLeft size={15}/> Cases</Link><span>/</span><span>{item.reference}</span></div>

    <header className="folio-header">
      <div><div className="folio-title-line"><h1 className="folio-reference">{item.reference}</h1><span className="folio-folder">{item.category}</span></div><p>Received {item.createdLabel.toLocaleLowerCase()} · {item.evidence.length} evidence item{item.evidence.length === 1 ? "" : "s"}</p></div>
      <div className="folio-status"><small>Current case status</small><strong>{item.status}</strong><span>Set and changed by the review workflow</span></div>
    </header>

    <div className="provenance-legend" aria-label="Information provenance legend"><strong>Reading key</strong><span><i/>Original evidence</span><span><i/>Extracted fact</span><span><i/>Analysis-assisted observation</span></div>

    <section className="reconstruction-summary">
      <span><FileSearch size={23}/></span>
      <div><small className="folio-meta-label">Case reconstruction</small><h2>What happened</h2><p>{item.summary}</p><em>Prepared from the submitted complaint and available evidence. It remains a review aid, not a finding of fact.</em></div>
    </section>

    <div className="folio-grid">
      <div className="folio-main">
        <section className="folio-section hero-timeline">
          <div className="folio-section-head"><div><h2>Chronological reconstruction</h2><p>Events stay attached to the source and precision available in the record.</p></div><span>{details?.timeline.length || 0} events</span></div>
          {details?.timeline.length ? <div className="reconstruction-timeline">{details.timeline.map((event, index) => <div className="reconstruction-event" key={`${event.when}-${event.what}-${index}`}>
            <time className="event-time">{event.when}</time><i className="event-node"/>
            <div className="event-copy"><strong>{event.what}</strong><span className="precision-tag">{event.precision}</span><p>{event.precision === "Exact" ? "Time supplied explicitly in the complaint record." : event.precision === "Repeated" ? "Reported as a repeated event; no single exact time is assumed." : "Chronology is approximate; exact ordering has not been inferred."}</p><SourceTrace source={event.source}/></div>
          </div>)}</div> : <div className="empty-ledger"><CircleHelp size={18}/><span>No supported event time is available yet. The timeline stays empty rather than inventing an order.</span></div>}
        </section>

        <section className="folio-section">
          <div className="folio-section-head"><div><h2>Extracted indicators</h2><p>Explicit cyber identifiers only. Generic people, places and category words are excluded.</p></div><span>{indicators.length} found</span></div>
          {indicators.length ? <div className="indicator-ledger">{indicators.map(indicator => <div className="indicator-row" key={`${indicator.type}-${indicator.value}`}><small>{indicator.type}</small><strong className="indicator-value">{indicator.value}</strong><SourceTrace source={indicator.source}/></div>)}</div> : <div className="empty-ledger"><Info size={18}/><span>No explicit phone, email, payment ID, transaction reference, URL, domain or social handle was extracted.</span></div>}
        </section>

        <RelatedIncidents complaintId={item.id}/>
        <PreventionWarning complaintId={item.id}/>

        {details && <section className="folio-section">
          <div className="folio-section-head"><div><h2>Source trace</h2><p>Each extracted fact points back to the submitted narrative, form or named evidence.</p></div><span>{details.facts.length} facts</span></div>
          {details.facts.length ? <div className="fact-trace">{details.facts.map((fact, index) => <div key={`${fact.label}-${fact.value}-${index}`}><span className="trace-kind">Extracted fact</span><small>{fact.label}</small><strong>{fact.value}</strong><SourceTrace source={fact.source}/></div>)}</div> : <div className="empty-ledger"><Info size={18}/><span>No structured facts have been extracted from the available material.</span></div>}
        </section>}

        {details?.concerns.length ? <section className="folio-section clarification-card"><div className="folio-section-head"><div><h2>Details that conflict</h2><p>These points need clarification rather than an automated conclusion.</p></div></div>{details.concerns.map(concern => <div className="review-concern" key={concern.issue}><AlertTriangle size={16}/><div><strong>{concern.issue}</strong><span>{concern.question}</span></div></div>)}</section> : null}

        <section className="folio-section narrative-record" id="original-narrative">
          <div className="folio-section-head"><div><h2>Original complaint narrative</h2><p>Reporter-provided text, preserved without rewriting.</p></div><span>Original source</span></div>
          <blockquote>{item.description}</blockquote>
        </section>

        <section className="folio-section" id="evidence-record">
          <div className="folio-section-head"><div><h2>Evidence record</h2><p>Original items and the observations currently associated with each one.</p></div><span>{item.evidence.length} attached</span></div>
          {item.evidence.length ? <div className="evidence-ledger">{item.evidence.map(file => {
            const finding = details?.evidenceAnalysis.find(result => result.fileName === file.name);
            return <article className="evidence-record" id={evidenceAnchor(file.name)} key={file.name}>
              <CaseEvidencePreview file={file}/>
              <div className="evidence-record-copy"><div><div><span className="trace-kind">Original evidence</span><strong>{file.name}</strong></div><small>{file.type} · {file.size}</small></div>
                {finding?.observations.map(observation => <p className="evidence-observation" key={observation}><CheckCircle2/>{observation}</p>)}
                {finding?.limitations.map(limitation => <p className="evidence-observation limitation" key={limitation}><Info/>{limitation}</p>)}
                {!finding && <p className="source-empty">No automated content observation is attached. The original item remains available for human review.</p>}
              </div>
            </article>;
          })}</div> : <div className="empty-ledger"><FileText size={20}/><span>No file was attached. The original narrative remains available for review.</span></div>}
        </section>
      </div>

      <aside className="folio-rail">
        <section className="folio-section">
          <div className="folio-section-head"><div><h2>Active signals</h2><p>Factual circumstances surfaced for human attention.</p></div><Activity size={18}/></div>
          {signals.length ? <div className="active-signal-list">{signals.map((signal, index) => <div className="active-signal" key={`${signal.label}-${index}`}><div><AlertTriangle/><span><strong>{signal.label}</strong><p>{signal.detail}</p><SourceTrace source={signal.source}/></span></div></div>)}</div> : <div className="empty-ledger"><Info size={18}/><span>No active factual signal was surfaced from the current record.</span></div>}
          <p className="signal-boundary">Signals are not a priority score. Policy and authorised people decide urgency and action.</p>
        </section>

        <section className="folio-section">
          <div className="folio-section-head"><div><h2>Missing information</h2><p>Only gaps detected from the current complaint are shown.</p></div><span>{item.missing.length}</span></div>
          {item.missing.length ? <div className="missing-list">{item.missing.map((missing, index) => <div className="missing-item" key={missing}><span>{index + 1}</span><div><strong>{missing}</strong><p>{missingInformation(missing)}</p></div></div>)}</div> : <div className="empty-ledger"><CheckCircle2 size={18}/><span>The current analysis did not identify a specific missing field. A reviewer may still request clarification.</span></div>}
        </section>

        <section className="folio-section" id="intake-details">
          <div className="folio-section-head"><div><h2>Case status</h2><p>Operational context, kept compact.</p></div></div>
          <div className="status-ledger"><div><span>Status</span><strong>{item.status}</strong></div><div><span>Subject folder</span><strong>{item.category}</strong></div><div><span>Reported location</span><strong>{location || "Not provided"}</strong></div><div><span>Proposed workspace</span><strong>{details?.routing.primaryUnit || item.department[0] || "Needs confirmation"}</strong></div><div><span>Information readiness</span><strong>{details?.routing.status || "Needs review"}</strong></div></div>
          {location && <p className="human-boundary"><MapPin/>Location is reporter supplied and may be approximate.</p>}
          <p className="human-boundary"><ShieldCheck/>A reviewer must check the source material, confirm the folder and record every operational decision.</p>
        </section>
      </aside>
    </div>
  </div>;
}

function CaseEvidencePreview({ file }: { file: EvidenceItem }) {
  if (file.type === "Image" && file.previewUrl) return <a className="review-evidence-preview review-evidence-clickable" href={file.previewUrl} target="_blank" rel="noreferrer" aria-label={`Open full preview of ${file.name}`}><Image src={file.previewUrl} alt={`Preview of ${file.name}`} fill sizes="220px" unoptimized={file.previewUrl.startsWith("blob:")}/></a>;
  if (file.type === "Video" && file.previewUrl) return <div className="review-evidence-preview"><video src={file.previewUrl} controls preload="metadata" aria-label={`Preview of ${file.name}`}/></div>;
  return <div className="review-evidence-preview placeholder">{file.type === "Video" ? <Video size={30}/> : file.type === "Image" ? <ImageIcon size={30}/> : <Paperclip size={30}/>}</div>;
}
