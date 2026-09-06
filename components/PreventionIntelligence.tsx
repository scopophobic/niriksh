"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDot, Fingerprint, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
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
  const linkedCases = patterns?.reduce((count, item) => count + item.complaint_count, 0) || 0;
  const recurringIndicators = new Set(patterns?.flatMap(item => item.indicators.map(indicator => `${indicator.type_label}:${indicator.display_value}`)) || []).size;
  return <div className="page prevention-page">
    <header className="prevention-hero"><div><p>Intelligence overview</p><h1>Turn case memory into safer next steps.</h1><span>Find repeated signals, verify the pattern with a person, then use that reviewed intelligence to guide future cases.</span><div className="prevention-hero-note"><LockKeyhole/>Warnings remain human-controlled.</div></div><div className="prevention-boundary"><ShieldCheck/><strong>Human verification is required</strong><span>Patterns are advisory. They never establish an offender, guilt, or legal responsibility.</span></div></header>
    {error && <div className="prevention-error"><AlertTriangle/><span>Prevention intelligence is unavailable while the canonical backend is offline.</span></div>}
    {!patterns && !error && <div className="prevention-loading"><LoaderCircle/>Building explainable patterns from exact shared indicators…</div>}
    {patterns && <>
      <section className="pattern-overview"><div><small>Patterns to review</small><strong>{emerging.length}</strong><span>Candidate signals needing a human decision</span></div><div><small>Verified intelligence</small><strong>{verified.length}</strong><span>Eligible for future warnings</span></div><div><small>Recurring signals</small><strong>{recurringIndicators}</strong><span>Exact identifiers across {linkedCases} linked case views</span></div></section>
      <section className="impact-loop"><div className="impact-loop-heading"><div><p>THE PREVENTION LOOP</p><h2>Make impact visible without making it up.</h2><span>These are evidence checkpoints. They show what the system did and what still needs an outcome signal.</span></div></div><div className="impact-steps"><div className="impact-step complete"><CircleDot/><small>Observed</small><strong>{recurringIndicators} recurring signals</strong><span>Exact indicators found across cases.</span></div><div className="impact-connector"/><div className={`impact-step ${verified.length ? "complete" : "current"}`}><ShieldCheck/><small>Decided</small><strong>{verified.length} verified patterns</strong><span>Human review controls promotion.</span></div><div className="impact-connector"/><div className="impact-step"><LockKeyhole/><small>Acted</small><strong>Warnings and follow-up</strong><span>Measure matches reviewed and interventions recorded.</span></div><div className="impact-connector"/><div className="impact-step"><CircleDot/><small>Learned</small><strong>Outcome evidence</strong><span>Collect acknowledgement, intervention, or reduced repeat harm.</span></div></div><div className="impact-proof"><strong>What you can prove today</strong><span>Linked cases, shared indicators, review decisions, and warning matches.</span><strong>What you should measure next</strong><span>Was the warning reviewed? Was action taken? Did the same signal recur after intervention?</span></div></section>
      <section className="pattern-section"><header><div><p>EMERGING PATTERNS</p><h2>Connections with their evidence visible</h2><span>Every card begins with exact shared identifiers. Behavioural context adds explanation; it does not prove a relationship.</span></div></header>
        {emerging.length ? <div className="pattern-grid">{emerging.map(pattern => <PatternCard key={pattern.id} pattern={pattern}/>)}</div> : <div className="pattern-empty"><CheckCircle2/>No unreviewed candidate currently needs attention.</div>}
      </section>
      {verified.length > 0 && <section className="pattern-section verified"><header><div><p>VERIFIED PREVENTION INTELLIGENCE</p><h2>Reviewed patterns ready to inform prevention</h2><span>Warnings and awareness drafts remain controlled outputs, not automatic publications.</span></div></header><div className="pattern-grid">{verified.map(pattern => <PatternCard key={pattern.id} pattern={pattern}/>)}</div></section>}
    </>}
  </div>;
}

function PatternCard({ pattern }: { pattern: Pattern }) { return <article className="pattern-card"><div className="pattern-card-head"><span className={`pattern-state ${pattern.status.toLowerCase()}`}>{label(pattern.status)}</span><Fingerprint/></div><h3>{pattern.title}</h3><p><strong>{pattern.complaint_count} related reports</strong> share recurring indicators and supporting context.</p><div className="pattern-dates"><span>First observed <b>{date(pattern.first_seen)}</b></span><span>Latest <b>{date(pattern.last_seen)}</b></span></div><div className="pattern-indicators">{pattern.indicators.slice(0, 3).map(item => <span key={`${item.type_label}-${item.display_value}`}><small>{item.type_label}</small><b>{item.display_value}</b><em>{item.case_count} cases</em></span>)}</div>{pattern.behavioural_pattern && <div className="pattern-behaviour"><small>Recurring behaviour</small><span>{pattern.behavioural_pattern}</span></div>}<Link href={`/prevention/${pattern.id}`}>View pattern <ArrowRight/></Link></article>; }
