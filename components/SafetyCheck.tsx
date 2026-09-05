"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Database, ExternalLink, EyeOff, Search, ShieldAlert } from "lucide-react";

interface DirectoryMatch {
  type: string;
  masked_value: string;
  found: boolean;
  status: "reported" | "reviewed_concern" | "cleared" | "no_published_record";
  report_count: number;
  meaning: string;
  review_note?: string;
  official_lookup_url: string;
}

interface MessageResult {
  assessment: string;
  signal_count: number;
  signals: Array<{ code: string; title: string; explanation: string }>;
  actions: string[];
  directory_matches: DirectoryMatch[];
  disclaimer: string;
  retention: string;
  official_report_url: string;
  official_lookup_url: string;
}

const EXAMPLE = "URGENT: Your bank account will be blocked. Share your OTP and pay the processing fee at demo-payee@upi now.";

async function postJson<T>(path: string, body: object): Promise<T> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || payload.detail || "The check could not be completed.");
  return payload as T;
}

function DirectoryResult({ result }: { result: DirectoryMatch }) {
  const label = result.status === "reviewed_concern" ? "Reviewed concern record"
    : result.status === "reported" ? "Previously reported"
      : result.status === "cleared" ? "Reviewed—record cleared"
        : "No published Niriksh record";
  return <article className={`safety-match ${result.found ? "found" : ""}`}>
    <div><span>{result.type.replace("_", " ")}</span><strong>{result.masked_value}</strong></div>
    <h3>{label}</h3>
    {result.found && <p>{result.report_count} complaint record{result.report_count === 1 ? "" : "s"} match this privacy-protected identifier.</p>}
    <p>{result.meaning}</p>
    {result.review_note && <p className="safety-note">Reviewer note: {result.review_note}</p>}
  </article>;
}

export function SafetyCheck() {
  const [tab, setTab] = useState<"message" | "identifier">("message");
  const [text, setText] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [messageResult, setMessageResult] = useState<MessageResult | null>(null);
  const [lookupResult, setLookupResult] = useState<DirectoryMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkMessage = async () => {
    setLoading(true); setError(""); setMessageResult(null);
    try { setMessageResult(await postJson<MessageResult>("/api/public/safety/check-message", { text })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The check could not be completed."); }
    finally { setLoading(false); }
  };
  const lookup = async () => {
    setLoading(true); setError(""); setLookupResult(null);
    try { setLookupResult(await postJson<DirectoryMatch>("/api/public/safety/lookup", { value: identifier })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The lookup could not be completed."); }
    finally { setLoading(false); }
  };

  return <div className="safety-page">
    <section className="safety-hero">
      <span className="eyebrow">SAFER DIGITAL DECISIONS</span>
      <h1>Check before you trust, click, or pay.</h1>
      <p>Understand common warning signs in a message and check whether an identifier appears in Niriksh&apos;s privacy-protected directory.</p>
      <div className="safety-privacy"><EyeOff/><span>Your pasted message is checked in memory and is not saved. This guidance never labels a person guilty.</span></div>
    </section>

    <section className="safety-tool">
      <div className="safety-tabs" role="tablist">
        <button className={tab === "message" ? "active" : ""} onClick={() => setTab("message")}><ShieldAlert/>Message check</button>
        <button className={tab === "identifier" ? "active" : ""} onClick={() => setTab("identifier")}><Database/>Identifier lookup</button>
      </div>

      {tab === "message" ? <div className="safety-panel">
        <div className="safety-panel-head"><div><span>Message, email, or offer</span><h2>What did you receive?</h2></div><button className="text-button" onClick={() => setText(EXAMPLE)}>Use fictional example</button></div>
        <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Paste the suspicious text here. Remove private information you do not want to analyse." rows={8}/>
        <button className="primary-action" disabled={loading || text.trim().length < 3} onClick={checkMessage}>{loading ? "Checking…" : "Check warning signs"}<ArrowRight/></button>

        {messageResult && <div className="safety-results">
          <div className={`safety-assessment ${messageResult.signal_count ? "caution" : "neutral"}`}><ShieldAlert/><div><span>RULE-BASED RESULT</span><h2>{messageResult.assessment}</h2><p>{messageResult.disclaimer}</p></div></div>
          <div className="safety-grid">
            <section><h3>What the checker noticed</h3>{messageResult.signals.length ? messageResult.signals.map(signal => <article className="safety-signal" key={signal.code}><strong>{signal.title}</strong><p>{signal.explanation}</p></article>) : <article className="safety-signal"><CheckCircle2/><p>No rule in the current checker matched. Still verify unexpected requests independently.</p></article>}</section>
            <section><h3>Useful next steps</h3><ol>{messageResult.actions.map(action => <li key={action}>{action}</li>)}</ol></section>
          </div>
          {messageResult.directory_matches.length > 0 && <section><h3>Identifiers found in the message</h3><div className="safety-match-grid">{messageResult.directory_matches.map((match, index) => <DirectoryResult result={match} key={`${match.type}-${index}`}/>)}</div></section>}
          <div className="safety-official"><a href={messageResult.official_lookup_url} target="_blank" rel="noreferrer">Check the official NCRP suspect repository<ExternalLink/></a><a href={messageResult.official_report_url} target="_blank" rel="noreferrer">Open cybercrime.gov.in<ExternalLink/></a></div>
        </div>}
      </div> : <div className="safety-panel">
        <span>Phone, email, UPI ID, URL, or social handle</span><h2>Search a privacy-protected record</h2>
        <p>Niriksh stores a one-way keyed fingerprint and a masked display value—not a public list of raw identifiers.</p>
        <div className="safety-search"><input value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder="Example: name@upi or +91…"/><button className="primary-action" disabled={loading || identifier.trim().length < 3} onClick={lookup}><Search/>{loading ? "Searching…" : "Search"}</button></div>
        {lookupResult && <><DirectoryResult result={lookupResult}/><a className="official-inline" href={lookupResult.official_lookup_url} target="_blank" rel="noreferrer">Also check the official NCRP repository<ExternalLink/></a></>}
      </div>}
      {error && <p className="form-error">{error}</p>}
    </section>

    <section className="safety-bottom"><div><h2>Need to report what happened?</h2><p>The complaint form preserves your account and evidence metadata for authorised human review.</p></div><Link href="/report">Register complaint<ArrowRight/></Link></section>
  </div>;
}
