"use client";

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, FileText, Image as ImageIcon, Info, Landmark, MapPin, Paperclip, Route, ShieldCheck, Video } from "lucide-react";
import { useCaseStore } from "@/lib/case-store";
import { EvidenceItem } from "@/lib/types";
import { SeverityBadge } from "./SeverityBadge";

export function CaseReview({ id }: { id: string }) {
  const { getCase } = useCaseStore();
  const item = getCase(id);
  if (!item) return <div className="not-found"><AlertTriangle size={34}/><h1>Case not found</h1><p>This case may have been cleared when the demo was reset.</p><Link className="button button-primary" href="/dashboard">Return to cases</Link></div>;

  const details = item.analysisDetails;
  const locationQuery = [item.complaintDetails?.policeStation, item.complaintDetails?.district, item.complaintDetails?.state].filter(Boolean).join(", ");
  return <div className="page simple-review-page">
    <div className="breadcrumbs"><Link href="/dashboard"><ArrowLeft size={15}/> Cases</Link><span>/</span><span>{item.reference}</span></div>
    <header className="simple-review-head">
      <div><span>EVIDENCE REVIEW</span><h1>{item.reference}</h1><p>{item.createdLabel} · {item.evidence.length} file{item.evidence.length === 1 ? "" : "s"} attached</p></div>
      <SeverityBadge level={item.severity}/>
    </header>

    <div className="simple-review-stack">
      <section className="case-brief hero-panel"><div className="simple-section-heading"><h2>What may have happened</h2><strong>{item.category}</strong></div><p>{item.summary}</p><div className="neutral-note"><Info size={15}/> This describes what was reported. It is not a final finding.</div></section>

      {details && <>
        {details.highlights.length > 0 && <section className="case-section important-highlights">
          <div className="simple-section-heading"><h2>Important indicators</h2><span>Each indicator keeps its source</span></div>
          <div>{details.highlights.map(highlight => <div className={`highlight-${highlight.level.toLowerCase()}`} key={highlight.label}><i/><span><strong>{highlight.label}</strong><p>{highlight.detail}</p><small>Source: {highlight.source}</small></span></div>)}</div>
        </section>}

        <div className="review-analysis-grid">
          <section className="case-section verification-card">
            <div className="simple-section-heading"><h2>Verification readiness</h2><strong>{details.verification.readiness}%</strong></div>
            <div>{details.verification.checks.map(check => <span className={`check-${check.status.toLowerCase().replace(" ", "-")}`} key={check.label}>{check.status === "Ready" ? <CheckCircle2/> : <AlertTriangle/>}<b>{check.label}</b><small>{check.detail}</small></span>)}</div>
            <p>{details.verification.disclaimer}</p>
          </section>
          <section className="case-section review-routing-card">
            <div className="simple-section-heading"><h2>Routing information</h2><span><Route size={14}/>{details.routing.status}</span></div>
            <div className="review-route-primary"><Landmark size={19}/><span><small>PRIMARY REVIEW</small><strong>{details.routing.primaryUnit}</strong><em>{details.routing.jurisdiction}</em></span></div>
            {details.routing.supportingUnits.map(unit => <p key={unit}><ShieldCheck size={13}/>{unit}</p>)}
            <small className="review-route-note">Recommendation only — a human must confirm the destination.</small>
          </section>
        </div>

        {locationQuery && <section className="case-section location-map-card">
          <div className="simple-section-heading"><div><MapPin size={17}/><h2>Reported location</h2></div><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationQuery)}`} target="_blank" rel="noreferrer">Open in Maps <ExternalLink size={13}/></a></div>
          <p className="location-map-label">{locationQuery}</p>
          <div className="location-map-frame"><iframe title={`Map showing ${locationQuery}`} src={`https://www.google.com/maps?q=${encodeURIComponent(locationQuery)}&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /></div>
          <small className="location-map-note">Approximate pin based on the State, district, and police station selected by the reporter. It is not a precise address.</small>
        </section>}

        <section className="case-section">
          <div className="simple-section-heading"><h2>Context</h2><span>From the description and files</span></div>
          <div className="plain-context-grid">
            <div><small>WHO REPORTED IT</small><strong>{details.context.reporterRole}</strong></div>
            <div><small>IS IT STILL HAPPENING?</small><strong>{details.context.incidentStatus}</strong></div>
            <div><small>POSSIBLE HARM</small><strong>{details.context.harm.join(", ") || "Not clear yet"}</strong></div>
            <div><small>ACTIONS ALREADY TAKEN</small><strong>{details.context.actionsTaken.join(", ") || "None mentioned"}</strong></div>
          </div>
        </section>

        {details.timeline.length > 0 && <section className="case-section">
          <div className="simple-section-heading"><h2>Timeline</h2><span>Each item keeps its source</span></div>
          <div className="plain-timeline">{details.timeline.map((event, index) => <div key={`${event.when}-${index}`}><i>{index + 1}</i><div><strong>{event.when}</strong><p>{event.what}</p><span>Source: {event.source}</span></div></div>)}</div>
        </section>}

        <section className="case-section">
          <div className="simple-section-heading"><h2>Useful details</h2><span>What was found and where</span></div>
          <div className="grounded-facts">{details.facts.map((fact, index) => <div key={`${fact.label}-${index}`}><small>{fact.label}</small><strong>{fact.value}</strong><span>{fact.source}</span></div>)}</div>
        </section>

        {details.concerns.length > 0 && <section className="case-section clarification-card"><div className="simple-section-heading"><h2>Something does not match</h2></div>{details.concerns.map(concern => <div className="review-concern" key={concern.issue}><AlertTriangle size={16}/><div><strong>{concern.issue}</strong><span>{concern.question}</span></div></div>)}</section>}
      </>}

      <section className="case-section">
        <div className="simple-section-heading"><h2>Original description</h2><span>Kept unchanged</span></div>
        <blockquote>{item.description}</blockquote>
      </section>

      <section className="case-section">
        <div className="simple-section-heading"><h2>Files and what they add</h2><span>{item.evidence.length} attached</span></div>
        {item.evidence.length ? <div className="review-evidence-list">{item.evidence.map(file => {
          const finding = details?.evidenceAnalysis.find(result => result.fileName === file.name);
          return <div className="review-evidence-item" key={file.name}><CaseEvidencePreview file={file}/><div><strong>{file.name}</strong><small>{file.type} · {file.size}</small>{finding?.observations.map(observation => <p key={observation}><CheckCircle2 size={13}/>{observation}</p>)}{finding?.limitations.map(limitation => <p className="limitation" key={limitation}><Info size={13}/>{limitation}</p>)}</div></div>;
        })}</div> : <div className="no-evidence"><FileText size={25}/><div><strong>No file attached</strong><span>The description can still be reviewed.</span></div></div>}
      </section>

      {item.missing.length > 0 && <section className="case-section"><div className="simple-section-heading"><h2>Information that may still help</h2></div><div className="review-missing">{item.missing.map(missing => <span key={missing}>+ {missing}</span>)}</div></section>}

      <div className="human-note"><ShieldCheck size={19}/><div><strong>Human check required</strong><span>The system organises the complaint and files. A reviewer must check the source material before making a decision.</span></div></div>
    </div>
  </div>;
}

function CaseEvidencePreview({ file }: { file: EvidenceItem }) {
  if (file.type === "Image" && file.previewUrl) return <a className="review-evidence-preview review-evidence-clickable" href={file.previewUrl} target="_blank" rel="noreferrer" aria-label={`Open full preview of ${file.name}`}><Image src={file.previewUrl} alt={`Preview of ${file.name}`} fill sizes="220px" unoptimized={file.previewUrl.startsWith("blob:")}/></a>;
  if (file.type === "Video" && file.previewUrl) return <div className="review-evidence-preview"><video src={file.previewUrl} controls preload="metadata" aria-label={`Preview of ${file.name}`}/></div>;
  return <div className="review-evidence-preview placeholder">{file.type === "Video" ? <Video size={30}/> : file.type === "Image" ? <ImageIcon size={30}/> : <Paperclip size={30}/>}</div>;
}
