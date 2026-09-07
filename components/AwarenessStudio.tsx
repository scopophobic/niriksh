"use client";

import Link from "next/link";
import {
  ArrowRight, Check, CheckCircle2, Clapperboard, Download, FileText, Languages,
  LoaderCircle, LockKeyhole, Megaphone, Play, ShieldCheck, Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildAwarenessCampaign, campaignAsText, type AwarenessCampaign, type AwarenessPattern,
} from "@/lib/awareness-campaign";

type ReviewKey = "evidence" | "privacy" | "guidance";
type Format = "video" | "advisory" | "share-card";

const FORMATS = [
  { id: "video" as const, name: "60-second awareness video", icon: Clapperboard, detail: "Four-scene storyboard and narration" },
  { id: "advisory" as const, name: "Short advisory", icon: FileText, detail: "Concise copy for public review" },
  { id: "share-card" as const, name: "WhatsApp share card", icon: Megaphone, detail: "Forwardable warning copy" },
];

const REVIEW_ITEMS: Array<{ id: ReviewKey; label: string }> = [
  { id: "evidence", label: "The message accurately reflects the verified pattern" },
  { id: "privacy", label: "No complainant or live case identifier is exposed" },
  { id: "guidance", label: "The safety guidance and reporting route are current" },
];

export function AwarenessStudio({ initialPatternId }: { initialPatternId?: string }) {
  const [patterns, setPatterns] = useState<AwarenessPattern[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [format, setFormat] = useState<Format>("video");
  const [language, setLanguage] = useState("English");
  const [audience, setAudience] = useState("General public");
  const [campaign, setCampaign] = useState<AwarenessCampaign>();
  const [activeScene, setActiveScene] = useState(0);
  const [checks, setChecks] = useState<Record<ReviewKey, boolean>>({ evidence: false, privacy: false, guidance: false });
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/prevention/patterns", { cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((items: AwarenessPattern[]) => {
        const verified = items.filter(item => item.status === "VERIFIED");
        setPatterns(verified);
        setSelectedId(verified.some(item => item.id === initialPatternId) ? initialPatternId || "" : verified[0]?.id || "");
        setLoading(false);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
        setLoading(false);
      });
    return () => controller.abort();
  }, [initialPatternId]);

  const selected = useMemo(() => patterns.find(item => item.id === selectedId), [patterns, selectedId]);
  const reviewComplete = Object.values(checks).every(Boolean);

  const resetDraft = () => {
    setCampaign(undefined);
    setActiveScene(0);
    setChecks({ evidence: false, privacy: false, guidance: false });
    setApproved(false);
  };

  const createDraft = () => {
    if (!selected) return;
    setCampaign(buildAwarenessCampaign(selected, language, audience));
    setActiveScene(0);
    setChecks({ evidence: false, privacy: false, guidance: false });
    setApproved(false);
  };

  const downloadBrief = () => {
    if (!campaign || !approved) return;
    const blob = new Blob([campaignAsText(campaign)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected?.id || "awareness"}-video-brief.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="page awareness-page">
    <header className="studio-header">
      <div><p>Awareness studio</p><h1>Turn a verified pattern into a public warning.</h1><span>Build an evidence-linked video storyboard, check it with a person, then hand an approved brief to production. Nothing publishes automatically.</span></div>
      <div className="studio-boundary"><LockKeyhole/><strong>Human approval required</strong><span>Only verified patterns can enter this workflow. Raw case identifiers stay out of public copy.</span></div>
    </header>

    <div className="awareness-workflow" aria-label="Awareness video workflow">
      <span className="complete"><CheckCircle2/>Pattern found</span><i/><span className="complete"><ShieldCheck/>Human verified</span><i/><span className={campaign ? "complete" : "current"}><Clapperboard/>Video brief</span><i/><span className={approved ? "complete" : ""}><Check/>Approval</span>
    </div>

    {initialPatternId && selected?.id === initialPatternId && <div className="studio-handoff"><Sparkles/><div><strong>Pattern carried into the studio</strong><span>{selected.title} is selected with its evidence count and recurring signal types.</span></div><Link href={`/prevention/${selected.id}`}>Review source pattern <ArrowRight/></Link></div>}

    <div className="studio-layout">
      <section className="studio-builder">
        <div className="studio-section-title"><span className="studio-step">1</span><div><h2>Choose verified intelligence</h2><p>Only a reviewer-approved pattern can become public guidance.</p></div></div>
        {loading ? <div className="studio-loading"><LoaderCircle/>Loading verified patterns…</div> : patterns.length ? <div className="verified-pattern-picker">{patterns.map(pattern => <button type="button" key={pattern.id} className={pattern.id === selectedId ? "selected" : ""} onClick={() => { setSelectedId(pattern.id); resetDraft(); }}><div><ShieldCheck/><span><strong>{pattern.title}</strong><small>{pattern.complaint_count} supporting reports · {pattern.indicators.length} recurring signal types</small></span></div><ArrowRight/></button>)}</div> : <div className="studio-empty"><ShieldCheck/><div><strong>{loadError ? "Verified patterns could not be loaded" : "No verified patterns yet"}</strong><span>{loadError ? "Check the backend connection and try again." : "Review an emerging pattern before creating public guidance."}</span><Link href="/prevention">Review intelligence <ArrowRight/></Link></div></div>}

        <div className="studio-section-title"><span className="studio-step">2</span><div><h2>Shape the message</h2><p>Choose the output, audience, and language for human review.</p></div></div>
        <div className="format-options">{FORMATS.map(item => <button type="button" key={item.id} className={format === item.id ? "selected" : ""} onClick={() => { setFormat(item.id); resetDraft(); }}><item.icon/><span><strong>{item.name}</strong><small>{item.detail}</small></span></button>)}</div>
        <div className="studio-controls studio-controls-expanded">
          <label><Languages/>Language<select value={language} onChange={event => { setLanguage(event.target.value); resetDraft(); }}><option>English</option><option>Hindi</option><option>Kannada</option><option>Marathi</option></select></label>
          <label><Megaphone/>Audience<select value={audience} onChange={event => { setAudience(event.target.value); resetDraft(); }}><option>General public</option><option>Older adults</option><option>Students and young adults</option><option>Small businesses</option></select></label>
          <button type="button" className="studio-generate" disabled={!selected} onClick={createDraft}><Sparkles/>{format === "video" ? "Create video brief" : "Create draft"}</button>
        </div>
      </section>

      <aside className="studio-preview">
        <div className="preview-top"><div><small>{format === "video" ? "Video storyboard" : "Campaign draft"}</small><strong>{campaign ? approved ? "Approved for production" : "Ready for review" : "Waiting for a verified pattern"}</strong></div><span className={approved ? "preview-status approved" : campaign ? "preview-status ready" : "preview-status"}>{approved ? "Approved" : campaign ? "Review" : "Locked"}</span></div>
        {campaign && selected ? <>
          <div className="video-preview awareness-storyboard">
            <div className="video-scene-time">{campaign.scenes[activeScene].duration}</div>
            <div className="video-frame-copy"><small>Scene {activeScene + 1} of {campaign.scenes.length}</small><strong>{campaign.scenes[activeScene].onScreen}</strong><button type="button" aria-label="Preview next storyboard scene" onClick={() => setActiveScene(scene => (scene + 1) % campaign.scenes.length)}><Play/>Next scene</button></div>
            <div className="storyboard-progress">{campaign.scenes.map((scene, index) => <button type="button" key={scene.id} className={index === activeScene ? "active" : ""} onClick={() => setActiveScene(index)} aria-label={`Preview ${scene.heading}`}/>)}</div>
          </div>
          <div className="campaign-brief"><small>Campaign brief</small><h2>{campaign.title}</h2><p>{campaign.objective}</p><span><ShieldCheck/>{campaign.evidenceLine}</span></div>
          <div className="scene-list">{campaign.scenes.map((scene, index) => <button type="button" className={index === activeScene ? "active" : ""} key={scene.id} onClick={() => setActiveScene(index)}><time>{scene.duration}</time><span><strong>{scene.heading}</strong><small>{scene.narration}</small></span></button>)}</div>
          {language !== "English" && <div className="translation-note"><Languages/><span><strong>{language} adaptation selected</strong>This draft preserves source meaning in English. A fluent reviewer must adapt and approve the final narration.</span></div>}
          <div className="draft-meta"><span><Check/>Source: verified pattern</span><span><Languages/>{language}</span><span><Megaphone/>{audience}</span></div>
          <div className="approval-checklist"><strong>Review before production</strong>{REVIEW_ITEMS.map(item => <label key={item.id}><input type="checkbox" checked={checks[item.id]} onChange={event => { setChecks(current => ({ ...current, [item.id]: event.target.checked })); setApproved(false); }}/><span>{item.label}</span></label>)}<button type="button" disabled={!reviewComplete} onClick={() => setApproved(true)}><ShieldCheck/>Approve video brief</button>{approved && <button type="button" className="download-brief" onClick={downloadBrief}><Download/>Download production brief</button>}</div>
          <div className="publish-lock"><LockKeyhole/><div><strong>Approval does not publish the video</strong><span>The downloaded brief can move to filming, animation, or an approved video-generation service. Publication remains a separate human decision.</span></div></div>
        </> : <div className="preview-locked"><ShieldCheck/><h2>Verified intelligence becomes guidance here.</h2><p>Choose a verified pattern and create a draft to see the evidence trail, storyboard, narration, and approval gate together.</p></div>}
      </aside>
    </div>

    <section className="awareness-principles"><div><small>What makes this safe</small><h2>Awareness is an output of review, not a new source of truth.</h2></div><div><span><Check/> No automatic publishing</span><span><Check/> No accusations or named suspects</span><span><Check/> Raw indicators excluded from public copy</span><span><Check/> Review copy before production</span></div></section>
  </div>;
}
