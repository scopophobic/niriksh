"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Fingerprint, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type Pattern = { id: string; title: string; status: string; behavioural_pattern?: string; complaint_count: number; first_seen: string; last_seen: string; indicators: { type_label: string; display_value: string; case_count: number }[]; reasons: string[] };
const date = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
const label = (status: string) => status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());

export function PreventionIntelligence() {
  const [patterns, setPatterns] = useState<Pattern[]>();
  const [error, setError] = useState(false);
  useEffect(() => { fetch("/api/prevention/patterns", { cache: "no-store" }).then(response => response.ok ? response.json() : Promise.reject()).then(setPatterns).catch(() => setError(true)); }, []);
  const verified = patterns?.filter(item => item.status === "VERIFIED") || [];
  const emerging = patterns?.filter(item => item.status !== "VERIFIED" && item.status !== "DISMISSED") || [];
  return <div className="page prevention-page">
    <header className="prevention-hero"><div><p>PREVENTION INTELLIGENCE</p><h1>Give incident systems memory.</h1><span>Structured reports become explainable, human-reviewed intelligence that can help surface repeated harm earlier.</span></div><div className="prevention-boundary"><ShieldCheck/><strong>Human verification is required</strong><span>Patterns are advisory. They never establish an offender, guilt, or legal responsibility.</span></div></header>
    {error && <div className="prevention-error"><AlertTriangle/><span>Prevention intelligence is unavailable while the canonical backend is offline.</span></div>}
    {!patterns && !error && <div className="prevention-loading"><LoaderCircle/>Building explainable patterns from exact shared indicators…</div>}
    {patterns && <>
      <section className="pattern-overview"><div><small>EMERGING PATTERNS</small><strong>{emerging.length}</strong><span>Need human review</span></div><div><small>VERIFIED PATTERNS</small><strong>{verified.length}</strong><span>Can support future warnings</span></div><div><small>RECURRING INDICATORS</small><strong>{new Set(patterns.flatMap(item => item.indicators.map(indicator => `${indicator.type_label}:${indicator.display_value}`))).size}</strong><span>Exact normalized identifiers</span></div></section>
      <section className="pattern-section"><header><div><p>EMERGING PATTERNS</p><h2>Connections with their evidence visible</h2><span>Every card begins with exact shared identifiers. Behavioural context adds explanation; it does not prove a relationship.</span></div></header>
        {emerging.length ? <div className="pattern-grid">{emerging.map(pattern => <PatternCard key={pattern.id} pattern={pattern}/>)}</div> : <div className="pattern-empty"><CheckCircle2/>No unreviewed candidate currently needs attention.</div>}
      </section>
      {verified.length > 0 && <section className="pattern-section verified"><header><div><p>VERIFIED PREVENTION INTELLIGENCE</p><h2>Reviewed patterns ready to inform prevention</h2><span>Warnings and awareness drafts remain controlled outputs, not automatic publications.</span></div></header><div className="pattern-grid">{verified.map(pattern => <PatternCard key={pattern.id} pattern={pattern}/>)}</div></section>}
    </>}
  </div>;
}

function PatternCard({ pattern }: { pattern: Pattern }) { return <article className="pattern-card"><div className="pattern-card-head"><span className={`pattern-state ${pattern.status.toLowerCase()}`}>{label(pattern.status)}</span><Fingerprint/></div><h3>{pattern.title}</h3><p><strong>{pattern.complaint_count} related reports</strong> share recurring indicators and supporting context.</p><div className="pattern-dates"><span>First observed <b>{date(pattern.first_seen)}</b></span><span>Latest <b>{date(pattern.last_seen)}</b></span></div><div className="pattern-indicators">{pattern.indicators.slice(0, 3).map(item => <span key={`${item.type_label}-${item.display_value}`}><small>{item.type_label}</small><b>{item.display_value}</b><em>{item.case_count} cases</em></span>)}</div>{pattern.behavioural_pattern && <div className="pattern-behaviour"><small>Recurring behaviour</small><span>{pattern.behavioural_pattern}</span></div>}<Link href={`/prevention/${pattern.id}`}>View pattern <ArrowRight/></Link></article>; }
