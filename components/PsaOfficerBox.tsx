"use client";

import { AlertTriangle, Check, Clock, LoaderCircle, Play, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";

type Beat = { scene_number: number; visual_action: string; speaker: "mascot_a" | "mascot_b"; line: string };
type PublishResult = { ok: boolean; reason?: string; url?: string; video_id?: string; media_id?: string };
type QueueItem = {
  id: string; story_id: string; story_title: string; beats: Beat[]; video_url: string;
  resolution: string; duration_seconds: number; cost_cents: number; used_reference_images: boolean;
  source: string; status: string; review_note: string | null; publish_results: Record<string, PublishResult>;
  published_at: string | null; created_at: string;
};
const STATUS_LABEL: Record<string, string> = {
  pending_review: "Awaiting review", approved: "Approved", rejected: "Rejected",
  published: "Published", publish_failed: "Approved — publish failed",
};

async function errorFrom(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return (body && typeof body.detail === "string" && body.detail) || fallback;
}

export function PsaOfficerBox() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [error, setError] = useState("");

  const loadQueue = () => fetch("/api/awareness/psa/queue", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject()).then(setItems).catch(() => setItems([]));

  useEffect(() => { loadQueue(); }, []);

  const runNow = async () => {
    setRunLoading(true); setError("");
    try {
      const response = await fetch("/api/awareness/psa/auto-run", { method: "POST" });
      if (!response.ok) throw new Error(await errorFrom(response, "Auto-run failed"));
      await loadQueue();
    } catch (err) { setError(err instanceof Error ? err.message : "Auto-run failed"); }
    finally { setRunLoading(false); }
  };

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusyId(id); setError("");
    try {
      const response = await fetch(`/api/awareness/psa/queue/${id}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, note: notes[id] || null }) });
      if (!response.ok) throw new Error(await errorFrom(response, "Review failed"));
      await loadQueue();
    } catch (err) { setError(err instanceof Error ? err.message : "Review failed"); }
    finally { setBusyId(null); }
  };

  const pending = items.filter(item => item.status === "pending_review");
  const decided = items.filter(item => item.status !== "pending_review");

  return <div className="page prevention-page">
    <header className="prevention-hero">
      <div><p>PSA OFFICER BOX</p><h1>Approve before anything goes out.</h1><span>Every generated PSA lands here first, whether it came from the lab button or an external scheduled run hitting <code>POST /awareness/psa/auto-run</code>. Approving is what triggers publishing — nothing posts on its own.</span></div>
      <div className="prevention-boundary">
        <ShieldCheck/><strong>Manual trigger</strong>
        <span>Scheduling lives outside niriksh — point your cron/event runner at <code>POST /awareness/psa/auto-run</code>. This button calls the same endpoint.</span>
        <button disabled={runLoading} onClick={runNow} style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>{runLoading ? <LoaderCircle className="spin"/> : <Play/>}Run now</button>
      </div>
    </header>

    {error && <div className="prevention-error" style={{ marginTop: 20 }}><AlertTriangle/>{error}</div>}

    <section className="pattern-section">
      <header><p>PENDING</p><h2>Waiting for a decision ({pending.length})</h2></header>
      {pending.length ? <div className="pattern-grid">{pending.map(item => <div className="pattern-card" key={item.id}>
        <div className="pattern-card-head"><Clock/><span className="pattern-state">{STATUS_LABEL[item.status]}</span></div>
        <h3>{item.story_title}</h3>
        <video src={item.video_url} controls style={{ width: "100%", borderRadius: 8 }}/>
        <p>{item.beats.length} beats · {item.duration_seconds}s {item.resolution} · ~${(item.cost_cents / 100).toFixed(2)} · {item.source} · {item.used_reference_images ? "image-referenced" : "text-only"}</p>
        <section className="pattern-detail-section review-panel" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
          <textarea value={notes[item.id] || ""} onChange={event => setNotes({ ...notes, [item.id]: event.target.value })} placeholder="Reviewer note (optional)"/>
          <div className="review-actions">
            <button disabled={busyId === item.id} onClick={() => decide(item.id, "approve")}><Check/>Approve &amp; publish</button>
            <button disabled={busyId === item.id} onClick={() => decide(item.id, "reject")}><X/>Reject</button>
          </div>
        </section>
      </div>)}</div> : <div className="pattern-empty"><ShieldCheck/><div><strong>Nothing waiting.</strong><span>Generate one from the PSA lab, or hit &ldquo;Run now&rdquo; above.</span></div></div>}
    </section>

    {decided.length > 0 && <section className="pattern-section">
      <header><p>DECIDED</p><h2>Recent decisions</h2></header>
      <div className="pattern-grid">{decided.slice(0, 12).map(item => <div className="pattern-card" key={item.id}>
        <div className="pattern-card-head"><ShieldCheck/><span className={`pattern-state ${item.status === "published" ? "verified" : item.status === "rejected" ? "dismissed" : ""}`}>{STATUS_LABEL[item.status]}</span></div>
        <h3>{item.story_title}</h3>
        {item.review_note && <p>&ldquo;{item.review_note}&rdquo;</p>}
        {Object.keys(item.publish_results).length > 0 && <div className="draft-meta">{Object.entries(item.publish_results).map(([channel, result]) => <span key={channel}>{result.ok ? <Check/> : <AlertTriangle/>}{channel}: {result.ok ? "posted" : result.reason}</span>)}</div>}
      </div>)}</div>
    </section>}
  </div>;
}
