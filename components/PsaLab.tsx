"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Check, Inbox, LoaderCircle, LockKeyhole, Play, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Story = { id: string; title: string; scam_category: string; mechanism_summary: string; source_citation: string; source_type: string };
type Beat = { scene_number: number; visual_action: string; speaker: "mascot_a" | "mascot_b"; line: string };
type Mascot = { name: string; sprite_url: string | null };
type Mascots = { mascot_a: Mascot; mascot_b: Mascot };
type RenderResult = { video_url: string; duration_seconds: number; resolution: string; cost_cents: number; fal_request_id: string; used_reference_images: boolean };

async function errorFrom(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return (body && typeof body.detail === "string" && body.detail) || fallback;
}

export function PsaLab() {
  const [stories, setStories] = useState<Story[]>([]);
  const [mascots, setMascots] = useState<Mascots | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [beats, setBeats] = useState<Beat[] | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptError, setScriptError] = useState("");
  const [render, setRender] = useState<RenderResult | null>(null);
  const [renderLoading, setRenderLoading] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [queued, setQueued] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [queueLoading, setQueueLoading] = useState(false);

  useEffect(() => {
    fetch("/api/awareness/psa/stories", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject()).then((items: Story[]) => { setStories(items); setSelectedId(items[0]?.id || ""); }).catch(() => setStories([]));
    fetch("/api/awareness/psa/mascots", { cache: "no-store" }).then(r => r.ok ? r.json() : Promise.reject()).then(setMascots).catch(() => setMascots(null));
  }, []);

  const selected = useMemo(() => stories.find(item => item.id === selectedId), [stories, selectedId]);

  const pickStory = (id: string) => { setSelectedId(id); setBeats(null); setScriptError(""); setRender(null); setRenderError(""); setQueued(false); setQueueError(""); };

  const writeScript = async () => {
    if (!selected) return;
    setScriptLoading(true); setScriptError(""); setBeats(null); setRender(null); setRenderError("");
    try {
      const response = await fetch("/api/awareness/psa/script", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story_id: selected.id }) });
      if (!response.ok) throw new Error(await errorFrom(response, "Script generation failed"));
      const data = await response.json();
      setBeats(data.beats);
    } catch (error) { setScriptError(error instanceof Error ? error.message : "Script generation failed"); }
    finally { setScriptLoading(false); }
  };

  const renderVideo = async () => {
    if (!selected || !beats) return;
    setRenderLoading(true); setRenderError(""); setRender(null); setQueued(false); setQueueError("");
    try {
      const response = await fetch("/api/awareness/psa/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story_id: selected.id, beats }) });
      if (!response.ok) throw new Error(await errorFrom(response, "Render failed"));
      setRender(await response.json());
    } catch (error) { setRenderError(error instanceof Error ? error.message : "Render failed"); }
    finally { setRenderLoading(false); }
  };

  const sendToOfficerBox = async () => {
    if (!selected || !beats || !render) return;
    setQueueLoading(true); setQueueError("");
    try {
      const response = await fetch("/api/awareness/psa/queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ story_id: selected.id, beats, render }) });
      if (!response.ok) throw new Error(await errorFrom(response, "Could not queue for review"));
      setQueued(true);
    } catch (error) { setQueueError(error instanceof Error ? error.message : "Could not queue for review"); }
    finally { setQueueLoading(false); }
  };

  return <div className="page awareness-page">
    <header className="studio-header">
      <div><p>PSA lab — pipeline test</p><h1>Turn a scam story into a two-mascot PSA.</h1><span>Generates a script and renders one real 10-second clip through MiniMax H3 Max Turbo. This is the scripting/render pipeline from <code>plan-awareness-psa.md</code>, tried end to end — nothing here publishes.</span></div>
      <div className="studio-boundary"><LockKeyhole/><strong>Placeholder mascots</strong><span>{mascots ? `${mascots.mascot_a.name} / ${mascots.mascot_b.name}` : "Loading…"} — swap for real character sheets before anything here ships.</span>
        {mascots?.mascot_a.sprite_url && mascots?.mascot_b.sprite_url
          ? <span style={{ display: "flex", gap: 8, marginTop: 6 }}><img src={mascots.mascot_a.sprite_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}/><img src={mascots.mascot_b.sprite_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover" }}/></span>
          : <span>No sprite images yet — run <code>backend/scripts/generate_mascot_sprites.py</code> once to render both as images instead of text.</span>}
      </div>
    </header>
    <div className="studio-layout">
      <section className="studio-builder">
        <div className="studio-section-title"><span className="studio-step">1</span><div><h2>Pick a researched story</h2><p>From <code>docs/research/corpus</code> — cited, no real names or identifiers.</p></div></div>
        {stories.length ? <div className="verified-pattern-picker">{stories.map(story => <button key={story.id} className={story.id === selectedId ? "selected" : ""} onClick={() => pickStory(story.id)}><div><ShieldCheck/><span><strong>{story.title}</strong><small>{story.scam_category} · {story.source_type.replace("_", " ")}</small></span></div><ArrowRight/></button>)}</div>
          : <div className="studio-empty"><ShieldCheck/><div><strong>No researched stories yet</strong><span>Run <code>docs/research/astra-scam-corpus-brief.md</code> and drop the output in <code>docs/research/corpus</code>.</span></div></div>}
        <div className="studio-controls"><span/><button className="studio-generate" disabled={!selected || scriptLoading} onClick={writeScript}>{scriptLoading ? <LoaderCircle className="spin"/> : <Sparkles/>}Write script</button></div>
        {scriptError && <div className="publish-lock"><AlertTriangle/><div><strong>Script generation failed</strong><span>{scriptError}</span></div></div>}
      </section>
      <aside className="studio-preview">
        <div className="preview-top"><div><small>Draft preview</small><strong>{beats ? "Script ready" : "Waiting for a story"}</strong></div><span className={beats ? "preview-status ready" : "preview-status"}>{beats ? "Draft" : "Locked"}</span></div>
        {beats ? <>
          <div className="draft-copy">{beats.map(beat => <p key={beat.scene_number}><strong>{beat.speaker === "mascot_a" ? mascots?.mascot_a.name : mascots?.mascot_b.name}</strong>{beat.visual_action} — &ldquo;{beat.line}&rdquo;</p>)}</div>
          <div className="video-preview">{render
            ? <video src={render.video_url} controls style={{ width: "100%", borderRadius: 10 }}/>
            : <><Play/><div className="video-preview-grid"><span>1</span><span>2</span><span>3</span></div><small>{renderLoading ? "Rendering… this can take up to a minute" : "Not rendered yet"}</small></>}</div>
          <div className="studio-controls"><span/><button className="studio-generate" disabled={renderLoading} onClick={renderVideo}>{renderLoading ? <LoaderCircle className="spin"/> : <Play/>}Generate video (10s, {mascots?.mascot_a.sprite_url ? "~$0.50 with reference images" : "~$0.25, text-only"})</button></div>
          {render && <div className="draft-meta"><span><Check/>{render.resolution}, {render.duration_seconds}s</span><span><Check/>~${(render.cost_cents / 100).toFixed(2)}</span><span><Check/>{render.used_reference_images ? "image-referenced" : "text-only"}</span><span><Check/>{render.fal_request_id}</span></div>}
          {renderError && <div className="publish-lock"><AlertTriangle/><div><strong>Render failed</strong><span>{renderError}</span></div></div>}
          {render && <div className="studio-controls"><span/><button className="studio-generate" disabled={queueLoading || queued} onClick={sendToOfficerBox}>{queueLoading ? <LoaderCircle className="spin"/> : <Inbox/>}{queued ? "Sent to officer box" : "Send to officer box"}</button></div>}
          {queueError && <div className="publish-lock"><AlertTriangle/><div><strong>Could not queue</strong><span>{queueError}</span></div></div>}
          <div className="publish-lock"><LockKeyhole/><div><strong>This page never publishes anything itself.</strong><span>Sending to the officer box only queues it for review — nothing posts anywhere until an officer approves it there. <Link href="/awareness/psa-lab/officer-box">Open the officer box →</Link></span></div></div>
        </> : <div className="preview-locked"><ShieldCheck/><h2>Pick a story and write a script to see beats here.</h2><p>{scriptLoading ? "Writing script…" : "The render step calls MiniMax H3 Max Turbo through fal — needs FAL_KEY set in the backend environment."}</p></div>}
      </aside>
    </div>
  </div>;
}
