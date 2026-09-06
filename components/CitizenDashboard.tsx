"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, BadgeCheck, Bell, CalendarClock, Check, CheckCircle2, ChevronRight, ClipboardList, Download, FileText, Headphones, Info, Landmark, LockKeyhole, MessageCircle, Phone, Plus, ShieldCheck, Sparkles, UserRoundCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useCaseStore } from "@/lib/case-store";

const statusSteps = ["Registered", "Analysis complete", "Officer review", "Routing", "Resolved"];

export function CitizenDashboard({ initialReference }: { initialReference?: string }) {
  const { cases } = useCaseStore();
  const citizenCases = useMemo(() => cases.filter(item => item.id === "ai-investment-video" || item.id.startsWith("submitted-") || item.id.startsWith("whatsapp-")), [cases]);
  const [selectedId, setSelectedId] = useState("");
  const selected = useMemo(() => citizenCases.find(item => item.id === selectedId)
    || (initialReference ? citizenCases.find(item => item.reference === initialReference) : undefined)
    || citizenCases[0], [citizenCases, initialReference, selectedId]);
  const currentStep = selected?.status === "Routed" ? 3 : selected?.status === "In review" ? 2 : selected?.status === "Needs information" ? 1 : 2;
  if (!selected) return null;

  const details = selected.analysisDetails;
  const assignedUnit = details?.routing.primaryUnit || selected.department[0] || "Cybercrime Review Unit";
  const reference = selected.reference;
  const downloadSummary = () => {
    const body = [`NIRIKSH CASE UPDATE`, `Reference: ${reference}`, `Status: ${selected.status}`, `Summary: ${selected.summary}`, `Review unit: ${assignedUnit}`, "", "Guidance:", "- Keep original evidence unchanged", "- Use your reference in every conversation", "- Call 1930 immediately for recent financial loss"].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${reference}-status-update.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <div className="citizen-dashboard-page">
    <section className="citizen-welcome">
      <div><span className="citizen-kicker"><BadgeCheck size={15}/> SECURE CASE PORTAL</span><h1>Your complaint, clearly explained.</h1><p>Follow every update, understand the analysis, and know exactly who to contact next.</p></div>
      <Link href="/report" className="citizen-primary"><Plus size={17}/> Register a new complaint</Link>
    </section>

    <div className="citizen-dashboard-grid">
      <aside className="citizen-case-list">
        <div className="citizen-section-title"><div><small>YOUR REPORTS</small><h2>My complaints</h2></div><span>{citizenCases.length}</span></div>
        <div className="citizen-case-items">{citizenCases.map((item, index) => <button className={item.id === selected.id ? "active" : ""} key={item.id} onClick={() => setSelectedId(item.id)}>
          <span className={`case-list-symbol case-list-symbol-${index % 3}`}><FileText size={17}/></span>
          <span><strong>{item.category}</strong><small>{item.reference}</small><em>{item.status}</em></span><ChevronRight size={16}/>
        </button>)}</div>
        <div className="citizen-private-note"><LockKeyhole size={16}/><span><strong>Your information is protected</strong><small>Only authorised reviewers can access case material.</small></span></div>
      </aside>

      <div className="citizen-case-detail">
        <section className="citizen-case-hero">
          <div className="citizen-case-hero-top"><div><small>ACTIVE COMPLAINT</small><h2>{reference}</h2><p>Registered {selected.createdLabel} · {selected.platform || "Online incident"}</p></div><span className={`citizen-status citizen-status-${selected.status.toLowerCase().replaceAll(" ", "-")}`}><i/>{selected.status}</span></div>
          <div className="citizen-progress">{statusSteps.map((step, index) => <div className={index < currentStep ? "done" : index === currentStep ? "current" : ""} key={step}><span>{index < currentStep ? <Check size={14}/> : index + 1}</span><strong>{step}</strong>{index < statusSteps.length - 1 && <i/>}</div>)}</div>
          <div className="citizen-current-update"><Bell size={20}/><div><small>LATEST UPDATE · TODAY, 10:32 AM</small><strong>{selected.status === "Needs information" ? "We need one more detail from you" : "Your report is with the review team"}</strong><p>{selected.status === "Needs information" ? `Please add: ${selected.missing[0] || "the affected account information"}. This will help the team confirm the route.` : `The ${assignedUnit} is studying the description and attached evidence. No action is required from you right now.`}</p></div></div>
        </section>

        <div className="citizen-detail-columns">
          <div className="citizen-detail-main">
            <section className="citizen-panel analysis-summary-panel">
              <div className="citizen-panel-heading"><div><span><Sparkles size={17}/></span><div><small>AFTER ANALYSIS</small><h2>What we understood</h2></div></div><button onClick={downloadSummary}><Download size={15}/> Save update</button></div>
              <p className="citizen-summary-copy">{selected.summary}</p>
              <div className="analysis-facts"><div><small>POSSIBLE INCIDENT</small><strong>{selected.category}</strong></div><div><small>REPORTED ON</small><strong>{selected.platform || "Not provided"}</strong></div><div><small>EVIDENCE RECEIVED</small><strong>{selected.evidence.length} file{selected.evidence.length === 1 ? "" : "s"}</strong></div></div>
              <div className="analysis-disclaimer"><Info size={15}/><span>This is a plain-language analysis of what you reported—not a finding of guilt. An officer will verify it.</span></div>
            </section>

            <section className="citizen-panel update-timeline-panel">
              <div className="citizen-panel-heading"><div><span><CalendarClock size={17}/></span><div><small>CASE HISTORY</small><h2>Status updates</h2></div></div></div>
              <div className="citizen-update-timeline">
                <div className="latest"><i><UserRoundCheck size={14}/></i><span><small>Today, 10:32 AM</small><strong>Assigned for human review</strong><p>{assignedUnit} received the prepared case file.</p></span></div>
                {selected.audit.slice().reverse().map(event => <div key={`${event.label}-${event.time}`}><i><Check size={13}/></i><span><small>{event.time}</small><strong>{event.label}</strong><p>{event.detail}</p></span></div>)}
              </div>
            </section>

            <section className="citizen-guidance-card">
              <div><span><ShieldCheck size={20}/></span><div><small>PERSONALISED GUIDANCE</small><h2>What you should do now</h2></div></div>
              <div className="citizen-guidance-grid"><span><i>01</i><strong>Keep originals safe</strong><p>Do not edit, crop or delete the files and messages you reported.</p></span><span><i>02</i><strong>Save your reference</strong><p>Quote {reference} whenever you contact the review team.</p></span><span><i>03</i><strong>Protect affected accounts</strong><p>Change exposed passwords and turn on two-factor authentication.</p></span></div>
              <div className="guidance-warning"><AlertCircle size={16}/><span><strong>Do not engage with the suspected account.</strong> Block it after saving evidence. Never send more money or OTPs.</span></div>
            </section>
          </div>

          <aside className="citizen-detail-aside">
            <section className="citizen-contact-card">
              <div className="contact-card-icon"><Headphones size={22}/></div><small>YOUR POINT OF CONTACT</small><h2>{assignedUnit}</h2><p>Case support desk · Mon–Sat, 9:30 AM–6:00 PM</p>
              <div className="contact-officer"><span>AS</span><div><strong>Ananya Sharma</strong><small>Case support officer</small></div><BadgeCheck size={16}/></div>
              <a href="tel:1930"><Phone size={15}/> Call support <strong>1930</strong></a><a href={`mailto:support@niriksh.example?subject=${reference}`}><MessageCircle size={15}/> Send a message</a>
              <div className="contact-note"><Info size={14}/>Keep your case reference ready when calling.</div>
            </section>
            <section className="citizen-route-card"><Landmark size={19}/><small>PROPOSED SUBJECT TEAM</small><h3>{assignedUnit}</h3><p>{details?.routing.jurisdiction || selected.location || "Jurisdiction confirmation in progress"}</p><span><CheckCircle2 size={14}/>Human confirmation required</span></section>
            <section className="citizen-help-card"><ClipboardList size={19}/><div><strong>Need immediate help?</strong><p>Call 112 if anyone is in danger. For recent financial fraud, call 1930 now.</p></div><a href="tel:112">Emergency 112 <ArrowRight size={14}/></a></section>
          </aside>
        </div>
      </div>
    </div>
  </div>;
}
