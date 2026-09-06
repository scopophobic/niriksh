"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CheckCircle2, Database, ExternalLink, EyeOff, FileAudio, FileImage, FileText, Search, ShieldAlert, Upload, Video, X } from "lucide-react";

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

interface ContentReview {
  insight: {
    situationSummary: string;
    evidenceFindings: Array<{ fileName: string; observations: string[]; visibleText: string[]; concerningSignals: string[]; limitations: string[] }>;
    limitations: string[];
  };
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
  const [files, setFiles] = useState<File[]>([]);
  const [messageResult, setMessageResult] = useState<MessageResult | null>(null);
  const [contentReview, setContentReview] = useState<ContentReview | null>(null);
  const [lookupResult, setLookupResult] = useState<DirectoryMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const checkMessage = async () => {
    if (text.trim().length < 3 && files.length === 0) return;
    setLoading(true); setError(""); setMessageResult(null); setContentReview(null);
    try {
      const tasks: Promise<void>[] = [];
      if (text.trim().length >= 3) tasks.push(postJson<MessageResult>("/api/public/safety/check-message", { text }).then(setMessageResult));
      if (files.length) {
        const form = new FormData();
        form.set("description", text || "Please review the attached content for possible cybercrime warning signs.");
        form.set("details", "{}");
        form.set("manifest", JSON.stringify(files.map(file => ({ name: file.name, type: file.type, size: file.size }))));
        files.forEach(file => form.append("evidence", file));
        tasks.push(fetch("/api/analyze", { method: "POST", body: form }).then(async response => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error || "The uploaded content could not be reviewed.");
          setContentReview(payload as ContentReview);
        }));
      }
      await Promise.all(tasks);
    }
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
      <p>Check suspicious text, screenshots, documents, voice notes, video, and more—then look up a known identifier privately.</p>
      <div className="safety-privacy"><EyeOff/><span>Your pasted text is checked in memory. Uploaded content is reviewed only for this check and is not added to the directory. This guidance never labels a person guilty.</span></div>
    </section>

    <section className="safety-tool">
      <div className="safety-tabs" role="tablist">
        <button className={tab === "message" ? "active" : ""} onClick={() => setTab("message")}><ShieldAlert/>Message check</button>
        <button className={tab === "identifier" ? "active" : ""} onClick={() => setTab("identifier")}><Database/>Identifier lookup</button>
      </div>

      {tab === "message" ? <div className="safety-panel">
        <div className="safety-panel-head"><div><span>Text or any evidence</span><h2>What did you receive?</h2></div><button className="text-button" onClick={() => setText(EXAMPLE)}>Use fictional example</button></div>
        <textarea value={text} onChange={event => setText(event.target.value)} placeholder="Paste a suspicious message, caption, transcript, link, or context. You can also upload the content itself below." rows={6}/>
        <label className="safety-upload">
          <input type="file" multiple accept="image/*,video/*,audio/*,application/pdf,text/*,.txt,.csv,.json,.doc,.docx" onChange={event => setFiles(previous => [...previous, ...Array.from(event.target.files || [])].slice(0, 12))}/>
          <span className="safety-upload-icon"><Upload/></span><span><strong>Add content to inspect</strong><small>Screenshots & images · PDFs & documents · voice notes & audio · video · text files</small></span><b>Choose files</b>
        </label>
        {files.length > 0 && <div className="safety-file-list">{files.map((file, index) => <div key={`${file.name}-${index}`}><span>{file.type.startsWith("image/") ? <FileImage/> : file.type.startsWith("audio/") ? <FileAudio/> : file.type.startsWith("video/") ? <Video/> : <FileText/>}</span><strong>{file.name}</strong><small>{Math.max(1, Math.round(file.size / 1024))} KB</small><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(previous => previous.filter((_, fileIndex) => fileIndex !== index))}><X/></button></div>)}</div>}
        <button className="primary-action" disabled={loading || (text.trim().length < 3 && files.length === 0)} onClick={checkMessage}>{loading ? "Checking…" : files.length ? "Review content" : "Check warning signs"}<ArrowRight/></button>

        {messageResult && <div className="safety-results">
          <div className={`safety-assessment ${messageResult.signal_count ? "caution" : "neutral"}`}><ShieldAlert/><div><span>RULE-BASED RESULT</span><h2>{messageResult.assessment}</h2><p>{messageResult.disclaimer}</p></div></div>
          <div className="safety-grid">
            <section><h3>What the checker noticed</h3>{messageResult.signals.length ? messageResult.signals.map(signal => <article className="safety-signal" key={signal.code}><strong>{signal.title}</strong><p>{signal.explanation}</p></article>) : <article className="safety-signal"><CheckCircle2/><p>No rule in the current checker matched. Still verify unexpected requests independently.</p></article>}</section>
            <section><h3>Useful next steps</h3><ol>{messageResult.actions.map(action => <li key={action}>{action}</li>)}</ol></section>
          </div>
          {messageResult.directory_matches.length > 0 && <section><h3>Identifiers found in the message</h3><div className="safety-match-grid">{messageResult.directory_matches.map((match, index) => <DirectoryResult result={match} key={`${match.type}-${index}`}/>)}</div></section>}
          <div className="safety-official"><a href={messageResult.official_lookup_url} target="_blank" rel="noreferrer">Check the official NCRP suspect repository<ExternalLink/></a><a href={messageResult.official_report_url} target="_blank" rel="noreferrer">Open cybercrime.gov.in<ExternalLink/></a></div>
        </div>}
        {contentReview && <div className="safety-content-results"><div className="safety-content-head"><FileImage/><div><span>CONTENT REVIEW</span><h2>{contentReview.insight.situationSummary}</h2><p>Observations are source-backed assistance, not a conclusion about a person or content&apos;s authenticity.</p></div></div><div className="safety-content-grid">{contentReview.insight.evidenceFindings.map(finding => <article key={finding.fileName}><strong>{finding.fileName}</strong>{[...finding.observations, ...finding.visibleText.map(value => `Visible text: ${value}`), ...finding.concerningSignals].slice(0, 5).map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}{finding.limitations.map((item, index) => <small key={`${item}-${index}`}>{item}</small>)}</article>)}</div>{contentReview.insight.limitations.length > 0 && <p className="safety-content-limitations">{contentReview.insight.limitations.join(" ")}</p>}</div>}
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
