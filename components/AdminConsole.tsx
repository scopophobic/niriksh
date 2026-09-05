"use client";

import { BrainCircuit, Check, CheckCircle2, ChevronDown, CircleGauge, Database, FileCheck2, Fingerprint, GitBranch, LockKeyhole, Save, ShieldCheck, ToggleLeft, ToggleRight, UserCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useCaseStore } from "@/lib/case-store";
import { REVIEW_CATEGORIES } from "@/lib/review-policy";

type AdminTab = "Operations" | "Category rules" | "Analysis safeguards" | "Audit log";

const teams = REVIEW_CATEGORIES.map((category, index) => ({ name: category.team, officers: 6 + index, active: 4 + (index % 4), color: ["#cb644e", "#3e7f91", "#a66582", "#b84945", "#398576", "#6f6aa8", "#8b7655"][index] }));
const initialRules = REVIEW_CATEGORIES.map(category => ({ category: category.label, primary: category.team, enabled: true }));

export function AdminConsole() {
  const { cases } = useCaseStore();
  const [tab, setTab] = useState<AdminTab>("Operations");
  const [rules, setRules] = useState(initialRules);
  const [toast, setToast] = useState("");
  const [citizenCheck, setCitizenCheck] = useState(true);
  const [sensitivePreview, setSensitivePreview] = useState(false);
  const unverified = cases.filter(item => item.citizenVerification?.status !== "Confirmed").length;
  const needsInformation = cases.filter(item => item.status === "Needs information").length;
  const events = useMemo(() => cases.flatMap(item => item.audit.map(event => ({ ...event, reference: item.reference }))).slice(0, 12), [cases]);
  const save = (message = "Configuration saved") => { setToast(message); setTimeout(() => setToast(""), 2800); };

  return <div className="page admin-page">
    {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    <section className="admin-heading"><div><span className="eyebrow">NIRIKSH CONTROL PLANE</span><h1>Administration</h1><p>Manage subject folders, human routing controls, analysis safeguards, and accountability.</p></div><div className="admin-identity"><span><LockKeyhole size={15}/> ADMIN ACCESS</span><strong>Authorised administrator</strong><small>Human-controlled workspace</small></div></section>

    <nav className="admin-tabs">{(["Operations", "Category rules", "Analysis safeguards", "Audit log"] as AdminTab[]).map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item === "Operations" ? <CircleGauge/> : item === "Category rules" ? <GitBranch/> : item === "Analysis safeguards" ? <BrainCircuit/> : <Fingerprint/>}{item}</button>)}</nav>

    {tab === "Operations" && <div className="admin-content">
      <section className="admin-stat-grid">
        <div><span className="admin-stat-icon teal"><FileCheck2/></span><small>Open case records</small><strong>{cases.length}</strong><em>Shown in received order</em></div>
        <div><span className="admin-stat-icon amber"><UserCheck/></span><small>Need information</small><strong>{needsInformation}</strong><em>Requires human follow-up</em></div>
        <div><span className="admin-stat-icon blue"><Users/></span><small>Subject teams</small><strong>{teams.length}</strong><em>Configured destinations</em></div>
        <div><span className="admin-stat-icon teal"><UserCheck/></span><small>Citizen fact-check pending</small><strong>{unverified}</strong><em>Across active cases</em></div>
      </section>
      <section className="admin-panel capacity-panel"><div className="admin-panel-head"><div><h2>Cases by subject team</h2><p>Counts are descriptive workload totals, not risk scores.</p></div></div><div className="capacity-head"><span>TEAM</span><span>ON DUTY</span><span>OPEN CASES</span><span>POLICY</span></div>{teams.map(team => { const count = cases.filter(item => item.department.includes(team.name)).length; return <div className="capacity-row" key={team.name}><div><i style={{ background: team.color }}/><strong>{team.name}</strong></div><span>{team.active} / {team.officers}</span><b>{count}</b><div><strong>Human assignment</strong></div></div>; })}</section>
      <section className="admin-panel system-strip"><div><span className="system-ok"><Check/></span><p><strong>Decision boundary enforced</strong><small>AI may extract and summarise source material; it cannot score priority, classify guilt, or route a case.</small></p></div>{["Object storage", "Analysis workers", "Audit ledger", "Notification service"].map(service => <span key={service}><i/>{service}<small>Configured</small></span>)}</section>
    </div>}

    {tab === "Category rules" && <section className="admin-panel routing-admin"><div className="admin-panel-head"><div><h2>Subject folder to team mapping</h2><p>The intake selection proposes a workspace. An officer records the final routing decision and reason.</p></div><button className="button button-primary" onClick={() => save("Category rules saved")}><Save size={15}/> Save rules</button></div><div className="rule-head"><span>SUBJECT FOLDER</span><span>PROPOSED TEAM</span><span>DECISION OWNER</span><span>STATUS</span></div>{rules.map((rule, index) => <div className="rule-row" key={rule.category}><strong>{rule.category}</strong><label><select value={rule.primary} onChange={event => setRules(items => items.map((item, i) => i === index ? { ...item, primary: event.target.value } : item))}>{teams.map(team => <option key={team.name}>{team.name}</option>)}</select><ChevronDown/></label><span>Authorised officer</span><button className={`rule-toggle ${rule.enabled ? "enabled" : ""}`} onClick={() => setRules(items => items.map((item, i) => i === index ? { ...item, enabled: !item.enabled } : item))}>{rule.enabled ? <ToggleRight/> : <ToggleLeft/>}{rule.enabled ? "Active" : "Paused"}</button></div>)}</section>}

    {tab === "Analysis safeguards" && <div className="governance-grid">
      <section className="admin-panel governance-main"><div className="admin-panel-head"><div><h2>Evidence-analysis policy</h2><p>Control how automated extraction enters the human workflow.</p></div><span className="version-tag">Human decision policy</span></div><div className="governance-setting"><div><strong>Automated decision fields</strong><p>Priority, guilt, legal classification, and routing are absent from the connected model schema and neutralised for legacy records.</p></div><b>Disabled</b></div><ToggleSetting title="Citizen fact-check" detail="Ask complainants to verify summaries and extracted facts before submission." value={citizenCheck} setValue={setCitizenCheck}/><ToggleSetting title="Sensitive evidence previews" detail="Show intimate or child-safety evidence thumbnails by default." value={sensitivePreview} setValue={setSensitivePreview} dangerous/><div className="governance-actions"><button className="button button-primary" onClick={() => save("Analysis safeguards saved")}><Save size={15}/> Save safeguards</button></div></section>
      <aside className="governance-side"><section className="admin-panel model-card"><span><BrainCircuit size={18}/> ANALYSIS ROLE</span><strong>Extraction and summarisation only</strong><p>No automated priority or routing</p><div><i/>Boundary enforced</div></section><section className="admin-panel guardrail-card"><span><ShieldCheck size={18}/> ENFORCED GUARDRAILS</span>{["No priority scores", "No legal conclusions", "No guilt determination", "No autonomous routing", "Source-linked observations", "Human confirmation required"].map(item => <div key={item}><Check size={13}/>{item}</div>)}</section><section className="admin-panel data-card"><Database size={19}/><div><span>DIRECTORY PRIVACY</span><strong>Keyed hashes + masked values</strong><small>Raw identifiers are not publicly enumerated</small></div></section></aside>
    </div>}

    {tab === "Audit log" && <section className="admin-panel audit-admin"><div className="admin-panel-head"><div><h2>System activity log</h2><p>Automated extraction, citizen corrections, and human decisions remain attributable.</p></div><button>Export log</button></div><div className="audit-table"><div className="audit-head"><span>EVENT</span><span>CASE</span><span>ACTOR</span><span>TIME</span><span>INTEGRITY</span></div>{events.map((event, index) => <div className="audit-row" key={`${event.reference}-${index}`}><div><span className="audit-symbol">{event.actor.includes("Niriksh") ? <BrainCircuit/> : event.actor === "Complainant" ? <UserCheck/> : <Fingerprint/>}</span><p><strong>{event.label}</strong><small>{event.detail}</small></p></div><b>{event.reference}</b><span>{event.actor}</span><span>{event.time}</span><em><CheckCircle2/>Recorded</em></div>)}</div></section>}
  </div>;
}

function ToggleSetting({ title, detail, value, setValue, dangerous = false }: { title: string; detail: string; value: boolean; setValue: (value: boolean) => void; dangerous?: boolean }) {
  return <div className="governance-setting"><div><strong>{title}{dangerous && <em>Restricted</em>}</strong><p>{detail}</p></div><button className={`governance-toggle ${value ? "enabled" : ""} ${dangerous ? "dangerous" : ""}`} onClick={() => setValue(!value)}>{value ? <ToggleRight/> : <ToggleLeft/>}<span>{value ? "Enabled" : "Disabled"}</span></button></div>;
}
