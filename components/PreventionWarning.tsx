"use client";

import Link from "next/link";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

type Match = { pattern_id: string; pattern_name: string; previous_case_count: number; matched_indicators: { type_label: string; display_value: string }[]; message: string };

export function PreventionWarning({ complaintId }: { complaintId: string }) {
  const [matches, setMatches] = useState<Match[]>();
  useEffect(() => { fetch(`/api/cases/${encodeURIComponent(complaintId)}/prevention-matches`, { cache: "no-store" }).then(response => response.ok ? response.json() : Promise.reject()).then(payload => setMatches(payload.matches)).catch(() => setMatches([])); }, [complaintId]);
  if (!matches) return <div className="prevention-case-loading"><LoaderCircle/>Checking reviewed prevention intelligence…</div>;
  if (!matches.length) return null;
  return <section className="prevention-warning"><div><ShieldAlert/><span>PREVIOUSLY OBSERVED</span></div>{matches.map(match => <article key={match.pattern_id}><strong>Known pattern match: {match.pattern_name}</strong><p>{match.message}</p><div>{match.matched_indicators.map(item => <span key={`${item.type_label}-${item.display_value}`}>{item.type_label}: <b>{item.display_value}</b></span>)}</div><small>This pattern has {match.previous_case_count} previously supporting reports.</small><Link href={`/prevention/${match.pattern_id}`}>Review pattern and supporting reports</Link></article>)}</section>;
}
