"use client";

import Link from "next/link";
import {
  AlignLeft, ArrowRight, Check, CheckCircle2, Clapperboard, Download, Image as ImageIcon,
  Languages, LoaderCircle, LockKeyhole, Megaphone, Play, ShieldCheck, Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  buildAwarenessCampaign, campaignAsText, type AwarenessCampaign, type AwarenessFormat,
  type AwarenessPattern, type ImageAwarenessCampaign, type TextAwarenessCampaign,
  type VideoAwarenessCampaign,
} from "@/lib/awareness-campaign";

type ReviewKey = "evidence" | "privacy" | "guidance";

const FORMATS = [
  { id: "video" as const, name: "Video awareness", icon: Clapperboard, detail: "60-second storyboard and narration" },
  { id: "image" as const, name: "Image awareness", icon: ImageIcon, detail: "Shareable public-safety poster" },
  { id: "text" as const, name: "Text awareness", icon: AlignLeft, detail: "Ready-to-review written advisory" },
];

const FORMAT_LABELS: Record<AwarenessFormat, string> = {
  video: "Video awareness",
  image: "Image awareness",
  text: "Text awareness",
};

const REVIEW_ITEMS: Array<{ id: ReviewKey; label: string }> = [
  { id: "evidence", label: "The message accurately reflects the verified pattern" },
  { id: "privacy", label: "No complainant or live case identifier is exposed" },
  { id: "guidance", label: "The safety guidance and reporting route are current" },
];

const EMPTY_CHECKS: Record<ReviewKey, boolean> = { evidence: false, privacy: false, guidance: false };

function VideoPreview({ campaign, activeScene, onSelect }: {
  campaign: VideoAwarenessCampaign;
  activeScene: number;
  onSelect: (scene: number) => void;
}) {
  const scene = campaign.scenes[activeScene];
  return <>
    <div className="video-preview awareness-storyboard">
      <div className="video-scene-time">{scene.duration}</div>
      <div className="video-frame-copy">
        <small>Scene {activeScene + 1} of {campaign.scenes.length}</small>
        <strong>{scene.onScreen}</strong>
        <button type="button" aria-label="Preview next storyboard scene" onClick={() => onSelect((activeScene + 1) % campaign.scenes.length)}><Play/>Next scene</button>
      </div>
      <div className="storyboard-progress">{campaign.scenes.map((item, index) => <button type="button" key={item.id} className={index === activeScene ? "active" : ""} onClick={() => onSelect(index)} aria-label={`Preview ${item.heading}`}/>)}</div>
    </div>
    <div className="scene-list">{campaign.scenes.map((item, index) => <button type="button" className={index === activeScene ? "active" : ""} key={item.id} onClick={() => onSelect(index)}><time>{item.duration}</time><span><strong>{item.heading}</strong><small>{item.narration}</small></span></button>)}</div>
  </>;
}

function ImagePreview({ campaign }: { campaign: ImageAwarenessCampaign }) {
  return <div className="awareness-image-preview">
    <div className="image-preview-brand"><ShieldCheck/><span>Niriksh public safety</span></div>
    <strong>{campaign.image.headline}</strong>
    <p>{campaign.image.body}</p>
    <div className="image-warning-list">{campaign.image.warningSigns.map(item => <span key={item}><Check/>{item}</span>)}</div>
    <div className="image-safe-action"><small>What to do</small><b>{campaign.image.action}</b></div>
    <footer>{campaign.image.footer}</footer>
  </div>;
}

function TextPreview({ campaign }: { campaign: TextAwarenessCampaign }) {
  return <article className="awareness-text-preview">
    <div><ShieldCheck/><span>Public cyber-safety advisory</span></div>
    <h3>{campaign.text.headline}</h3>
    <p>{campaign.text.introduction}</p>
    <h4>Warning signs to notice</h4>
    <ul>{campaign.text.warningSigns.map(item => <li key={item}>{item}</li>)}</ul>
    <h4>What to do</h4>
    <p>{campaign.text.action}</p>
    <footer>{campaign.text.closing}</footer>
  </article>;
}

function CampaignPreview({ campaign, activeScene, onSelectScene }: {
  campaign: AwarenessCampaign;
  activeScene: number;
  onSelectScene: (scene: number) => void;
}) {
  if (campaign.format === "video") return <VideoPreview campaign={campaign} activeScene={activeScene} onSelect={onSelectScene}/>;
  if (campaign.format === "image") return <ImagePreview campaign={campaign}/>;
  return <TextPreview campaign={campaign}/>;
}

export function AwarenessStudio({ initialPatternId }: { initialPatternId?: string }) {
  const [patterns, setPatterns] = useState<AwarenessPattern[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [format, setFormat] = useState<AwarenessFormat>("video");
  const [language, setLanguage] = useState("English");
  const [audience, setAudience] = useState("General public");
  const [campaign, setCampaign] = useState<AwarenessCampaign>();
  const [activeScene, setActiveScene] = useState(0);
  const [checks, setChecks] = useState<Record<ReviewKey, boolean>>(EMPTY_CHECKS);
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
    setChecks(EMPTY_CHECKS);
    setApproved(false);
  };

  const createDraft = () => {
    if (!selected) return;
    setCampaign(buildAwarenessCampaign(selected, language, audience, format));
    setActiveScene(0);
    setChecks(EMPTY_CHECKS);
    setApproved(false);
  };

  const downloadBrief = () => {
    if (!campaign || !approved) return;
    const blob = new Blob([campaignAsText(campaign)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selected?.id || "awareness"}-${campaign.format}-brief.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="page awareness-page">
    <header className="studio-header">
      <div><p>Awareness studio</p><h1>Turn a verified pattern into a public warning.</h1><span>Create video, image, or text awareness content, check it with a person, then hand off an approved brief. Nothing publishes automatically.</span></div>
      <div className="studio-boundary"><LockKeyhole/><strong>Human approval required</strong><span>Only verified patterns can enter this workflow. Raw case identifiers stay out of public copy.</span></div>
    </header>

    <div className="awareness-workflow" aria-label="Awareness content workflow">
      <span className="complete"><CheckCircle2/>Pattern found</span><i/><span className="complete"><ShieldCheck/>Human verified</span><i/><span className={campaign ? "complete" : "current"}><Megaphone/>Content draft</span><i/><span className={approved ? "complete" : ""}><Check/>Approval</span>
    </div>

    {initialPatternId && selected?.id === initialPatternId && <div className="studio-handoff"><Sparkles/><div><strong>Pattern carried into the studio</strong><span>{selected.title} is selected with its evidence count and recurring signal types.</span></div><Link href={`/prevention/${selected.id}`}>Review source pattern <ArrowRight/></Link></div>}

    <div className="studio-layout">
      <section className="studio-builder">
        <div className="studio-section-title"><span className="studio-step">1</span><div><h2>Choose verified intelligence</h2><p>Only a reviewer-approved pattern can become public guidance.</p></div></div>
        {loading ? <div className="studio-loading"><LoaderCircle/>Loading verified patterns…</div> : patterns.length ? <div className="verified-pattern-picker">{patterns.map(pattern => <button type="button" key={pattern.id} className={pattern.id === selectedId ? "selected" : ""} onClick={() => { setSelectedId(pattern.id); resetDraft(); }}><div><ShieldCheck/><span><strong>{pattern.title}</strong><small>{pattern.complaint_count} supporting reports · {pattern.indicators.length} recurring signal types</small></span></div><ArrowRight/></button>)}</div> : <div className="studio-empty"><ShieldCheck/><div><strong>{loadError ? "Verified patterns could not be loaded" : "No verified patterns yet"}</strong><span>{loadError ? "Check the backend connection and try again." : "Review an emerging pattern before creating public guidance."}</span><Link href="/prevention">Review intelligence <ArrowRight/></Link></div></div>}

        <div className="studio-section-title"><span className="studio-step">2</span><div><h2>Shape the message</h2><p>Choose the content format, audience, and language for human review.</p></div></div>
        <div className="format-options">{FORMATS.map(item => <button type="button" key={item.id} className={format === item.id ? "selected" : ""} aria-pressed={format === item.id} onClick={() => { setFormat(item.id); resetDraft(); }}><item.icon/><span><strong>{item.name}</strong><small>{item.detail}</small></span></button>)}</div>
        <div className="studio-controls studio-controls-expanded">
          <label><Languages/>Language<select value={language} onChange={event => { setLanguage(event.target.value); resetDraft(); }}><option>English</option><option>Hindi</option><option>Kannada</option><option>Marathi</option></select></label>
          <label><Megaphone/>Audience<select value={audience} onChange={event => { setAudience(event.target.value); resetDraft(); }}><option>General public</option><option>Older adults</option><option>Students and young adults</option><option>Small businesses</option></select></label>
          <button type="button" className="studio-generate" disabled={!selected} onClick={createDraft}><Sparkles/>Create {format} draft</button>
        </div>
      </section>

      <aside className="studio-preview">
        <div className="preview-top"><div><small>{FORMAT_LABELS[format]}</small><strong>{campaign ? approved ? "Approved for handoff" : "Ready for review" : "Waiting for a verified pattern"}</strong></div><span className={approved ? "preview-status approved" : campaign ? "preview-status ready" : "preview-status"}>{approved ? "Approved" : campaign ? "Review" : "Locked"}</span></div>
        {campaign && selected ? <>
          <CampaignPreview campaign={campaign} activeScene={activeScene} onSelectScene={setActiveScene}/>
          <div className="campaign-brief"><small>Campaign brief</small><h2>{campaign.title}</h2><p>{campaign.objective}</p><span><ShieldCheck/>{campaign.evidenceLine}</span></div>
          {language !== "English" && <div className="translation-note"><Languages/><span><strong>{language} adaptation selected</strong>This draft preserves source meaning in English. A fluent reviewer must adapt and approve the final content.</span></div>}
          <div className="draft-meta"><span><Check/>Source: verified pattern</span><span><Languages/>{language}</span><span><Megaphone/>{audience}</span></div>
          <div className="approval-checklist"><strong>Review before handoff</strong>{REVIEW_ITEMS.map(item => <label key={item.id}><input type="checkbox" checked={checks[item.id]} onChange={event => { setChecks(current => ({ ...current, [item.id]: event.target.checked })); setApproved(false); }}/><span>{item.label}</span></label>)}<button type="button" disabled={!reviewComplete} onClick={() => setApproved(true)}><ShieldCheck/>Approve {FORMAT_LABELS[campaign.format].toLowerCase()}</button>{approved && <button type="button" className="download-brief" onClick={downloadBrief}><Download/>Download approved brief</button>}</div>
          <div className="publish-lock"><LockKeyhole/><div><strong>Approval does not publish this content</strong><span>The downloaded brief can move to an approved production or publishing workflow. Publication remains a separate human decision.</span></div></div>
        </> : <div className="preview-locked"><ShieldCheck/><h2>Verified intelligence becomes guidance here.</h2><p>Choose a verified pattern and content format to see the evidence trail, public copy, and approval gate together.</p></div>}
      </aside>
    </div>

    <section className="awareness-principles"><div><small>What makes this safe</small><h2>Awareness is an output of review, not a new source of truth.</h2></div><div><span><Check/> No automatic publishing</span><span><Check/> No accusations or named suspects</span><span><Check/> Raw indicators excluded from public copy</span><span><Check/> Review every format before handoff</span></div></section>
  </div>;
}
