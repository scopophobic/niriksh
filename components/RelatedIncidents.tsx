"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Link2, LoaderCircle, RefreshCw, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { evidenceAnchor } from "@/lib/case-intelligence";
import type { IndicatorSource, RelatedIncidentsResponse } from "@/lib/types";

function SourceList({ sources, current }: { sources: IndicatorSource[]; current?: boolean }) {
  return <div className="connection-sources">{sources.map((source, index) => {
    const label = source.evidence_name ? `Evidence: ${source.evidence_name}` : source.label;
    return current && source.evidence_name
      ? <a key={`${label}-${index}`} href={`#${evidenceAnchor(source.evidence_name)}`}><Link2/>Source → {label}</a>
      : <span key={`${label}-${index}`}><Link2/>Source → {label}</span>;
  })}</div>;
}

export function RelatedIncidents({ complaintId }: { complaintId: string }) {
  const [data, setData] = useState<RelatedIncidentsResponse>();
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/cases/${encodeURIComponent(complaintId)}/related-incidents`, { cache: "no-store", signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Related incidents request failed: ${response.status}`);
        return response.json() as Promise<RelatedIncidentsResponse>;
      })
      .then(payload => { setData(payload); setState("ready"); })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState("error");
      });
    return () => controller.abort();
  }, [attempt, complaintId]);

  const retry = () => {
    setState("loading");
    setAttempt(value => value + 1);
  };

  return <section className="folio-section related-incidents" id="related-incidents">
    <div className="folio-section-head"><div><span className="connect-label"><Share2/>Connect</span><h2>Related incidents</h2><p>Cases that contain the same explicit normalized identifier.</p></div>{state === "ready" && <span>{data?.total || 0} potential connection{data?.total === 1 ? "" : "s"}</span>}</div>

    {state === "loading" && <div className="connection-state"><LoaderCircle className="connection-spinner"/><span>Checking exact identifier matches…</span></div>}
    {state === "error" && <div className="connection-state error"><AlertTriangle/><div><strong>Related incidents are unavailable</strong><span>The case may still be stored locally or the backend may be offline.</span></div><button type="button" onClick={retry}><RefreshCw/>Retry</button></div>}
    {state === "ready" && data && data.related_incidents.length === 0 && <div className="connection-state"><Link2/><div><strong>No shared identifier found</strong><span>No other stored complaint contains the same explicit phone, email, payment ID, transaction reference, URL, domain or scoped social handle.</span></div></div>}

    {state === "ready" && data && data.related_incidents.length > 0 && <div className="connection-list">{data.related_incidents.map(incident => <article className="connection-case" key={incident.complaint_id}>
      <header><div><Link href={`/cases/${encodeURIComponent(incident.complaint_id)}`}>{incident.reference}<ArrowUpRight/></Link><span>{incident.category} · {incident.status}</span></div><strong>{incident.matched_indicator_count} shared</strong></header>
      <p>{incident.summary}</p>
      <div className="shared-indicator-list">{incident.shared_indicators.map(indicator => <div className="shared-indicator" key={`${indicator.type}-${indicator.normalized_value}`}>
        <div className="shared-value"><small>{indicator.type_label}</small><strong>{indicator.display_value}</strong><span>Exact normalized match</span></div>
        <div className="shared-provenance"><div><small>This case</small><SourceList sources={indicator.current_sources} current/></div><i/><div><small>{incident.reference}</small><SourceList sources={indicator.related_sources}/></div></div>
      </div>)}</div>
    </article>)}</div>}

    <div className="connection-disclaimer"><AlertTriangle/><p>{data?.disclaimer || "Shared identifiers indicate a potential connection only and do not establish common ownership, identity, guilt or offender."}</p></div>
  </section>;
}
