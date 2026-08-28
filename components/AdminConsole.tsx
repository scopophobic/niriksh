"use client";

import { AlertTriangle, ArrowUpRight, BrainCircuit, Check, CheckCircle2, ChevronDown, CircleGauge, Database, FileCheck2, Fingerprint, GitBranch, LockKeyhole, Save, ShieldCheck, SlidersHorizontal, ToggleLeft, ToggleRight, UserCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useCaseStore } from "@/lib/case-store";

type AdminTab = "Operations" | "Routing rules" | "AI governance" | "Audit log";

const teams = [
  { name:"Financial Fraud Unit", officers:12, active:8, cases:18, capacity:78, color:"#cb644e" },
  { name:"Synthetic Media Review", officers:6, active:5, cases:14, capacity:92, color:"#b84945" },
  { name:"Women & Child Safety", officers:9, active:7, cases:9, capacity:66, color:"#a66582" },
  { name:"Social Media Abuse Unit", officers:8, active:6, cases:11, capacity:58, color:"#3e7f91" },
  { name:"General Cybercrime", officers:18, active:14, cases:21, capacity:71, color:"#398576" },
];

const initialRules = [
  { category:"Synthetic media impersonation", primary:"Synthetic Media Review", secondary:"Financial Fraud Unit", enabled:true },
  { category:"Online financial fraud", primary:"Financial Fraud Unit", secondary:"General Cybercrime", enabled:true },
  { category:"Synthetic child safety risk", primary:"Women & Child Safety", secondary:"Synthetic Media Review", enabled:true },
  { category:"Threats and cyber stalking", primary:"General Cybercrime", secondary:"Social Media Abuse Unit", enabled:true },
  { category:"Social media impersonation", primary:"Social Media Abuse Unit", secondary:"General Cybercrime", enabled:true },
];

export function AdminConsole() {
  const { cases } = useCaseStore();
  const [tab,setTab] = useState<AdminTab>("Operations");
  const [rules,setRules] = useState(initialRules);
  const [toast,setToast] = useState("");
  const [threshold,setThreshold] = useState(70);
  const [citizenCheck,setCitizenCheck] = useState(true);
  const [autoRoute,setAutoRoute] = useState(false);
  const [sensitivePreview,setSensitivePreview] = useState(false);
  const urgent = cases.filter(item => ["Critical","High"].includes(item.severity) && item.status !== "Routed").length;
  const unverified = cases.filter(item => item.citizenVerification?.status !== "Confirmed").length;
  const events = useMemo(() => cases.flatMap(item => item.audit.map(event => ({...event,reference:item.reference}))).slice(0,12),[cases]);
  const save = (message="Configuration saved") => { setToast(message); setTimeout(() => setToast(""),2800); };

  return <div className="page admin-page">
    {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}</div>}
    <section className="admin-heading"><div><span className="eyebrow">NIRIKSH CONTROL PLANE</span><h1>Administration</h1><p>Manage workload, routing policy, analysis safeguards, and accountability.</p></div><div className="admin-identity"><span><LockKeyhole size={15}/> ADMIN ACCESS</span><strong>Priya Nair</strong><small>System administrator · Last sign-in 09:31</small></div></section>

    {urgent > 0 && <section className="admin-priority-alert"><span><AlertTriangle size={23}/></span><div><small>OPERATIONAL PRIORITY</small><strong>{urgent} high-impact cases require active review</strong><p>Synthetic Media Review is at 92% capacity. Consider temporarily assigning an additional officer.</p></div><button onClick={() => setTab("Operations")}>Review workload <ArrowUpRight size={15}/></button></section>}

    <nav className="admin-tabs">{(["Operations","Routing rules","AI governance","Audit log"] as AdminTab[]).map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item === "Operations" ? <CircleGauge/> : item === "Routing rules" ? <GitBranch/> : item === "AI governance" ? <BrainCircuit/> : <Fingerprint/>}{item}</button>)}</nav>

    {tab === "Operations" && <div className="admin-content">
      <section className="admin-stat-grid">
        <div><span className="admin-stat-icon danger"><AlertTriangle/></span><small>Urgent review stack</small><strong>{urgent}</strong><em>2 inside 15-min target</em></div>
        <div><span className="admin-stat-icon teal"><Users/></span><small>On-duty officers</small><strong>40</strong><em>53 total authorised</em></div>
        <div><span className="admin-stat-icon amber"><UserCheck/></span><small>Citizen fact-check pending</small><strong>{unverified}</strong><em>Across {cases.length} active cases</em></div>
        <div><span className="admin-stat-icon blue"><FileCheck2/></span><small>Analysis jobs</small><strong>98.7%</strong><em>Successful in last 24h</em></div>
      </section>
      <div className="admin-columns">
        <section className="admin-panel capacity-panel"><div className="admin-panel-head"><div><h2>Team capacity</h2><p>Live distribution of open review work</p></div><button>Manage teams</button></div><div className="capacity-head"><span>TEAM</span><span>ON DUTY</span><span>OPEN CASES</span><span>LOAD</span></div>{teams.map(team => <div className="capacity-row" key={team.name}><div><i style={{background:team.color}}/><strong>{team.name}</strong></div><span>{team.active} / {team.officers}</span><b>{team.cases}</b><div><div><span style={{width:`${team.capacity}%`,background:team.color}}/></div><strong className={team.capacity > 85 ? "overload" : ""}>{team.capacity}%</strong></div></div>)}</section>
        <section className="admin-panel priority-policy"><div className="admin-panel-head"><div><h2>Priority policy</h2><p>Hard escalations always override scores</p></div><ShieldCheck size={19}/></div><div className="policy-critical"><AlertTriangle size={18}/><div><strong>Critical hard rules</strong><span>Child safety · Immediate threat · Active intimate-media distribution</span></div></div>{[{label:"Active financial loss",weight:50},{label:"Active extortion",weight:60},{label:"Ongoing distribution",weight:30},{label:"Identity impersonation",weight:20}].map(rule => <div className="weight-row" key={rule.label}><span>{rule.label}</span><b>+{rule.weight}</b></div>)}<button className="button button-ghost button-wide" onClick={() => setTab("AI governance")}><SlidersHorizontal size={15}/> Review scoring policy</button></section>
      </div>
      <section className="admin-panel system-strip"><div><span className="system-ok"><Check/></span><p><strong>All evidence services operational</strong><small>File validation, metadata extraction, transcription, OCR, and structured analysis</small></p></div>{["Object storage","Analysis workers","Audit ledger","Notification service"].map(service => <span key={service}><i/>{service}<small>Healthy</small></span>)}</section>
    </div>}

    {tab === "Routing rules" && <section className="admin-panel routing-admin"><div className="admin-panel-head"><div><h2>Category-to-team routing</h2><p>Recommendations are shown to officers; routing never happens without approval.</p></div><button className="button button-primary" onClick={() => save("Routing rules saved")}><Save size={15}/> Save rules</button></div><div className="rule-head"><span>CATEGORY</span><span>PRIMARY TEAM</span><span>SECONDARY TEAM</span><span>STATUS</span></div>{rules.map((rule,index) => <div className="rule-row" key={rule.category}><strong>{rule.category}</strong><label><select value={rule.primary} onChange={event => setRules(items => items.map((item,i) => i === index ? {...item,primary:event.target.value} : item))}>{teams.map(team => <option key={team.name}>{team.name}</option>)}</select><ChevronDown/></label><label><select value={rule.secondary} onChange={event => setRules(items => items.map((item,i) => i === index ? {...item,secondary:event.target.value} : item))}>{teams.map(team => <option key={team.name}>{team.name}</option>)}</select><ChevronDown/></label><button className={`rule-toggle ${rule.enabled ? "enabled" : ""}`} onClick={() => setRules(items => items.map((item,i) => i === index ? {...item,enabled:!item.enabled} : item))}>{rule.enabled ? <ToggleRight/> : <ToggleLeft/>}{rule.enabled ? "Active" : "Paused"}</button></div>)}</section>}

    {tab === "AI governance" && <div className="governance-grid">
      <section className="admin-panel governance-main"><div className="admin-panel-head"><div><h2>Evidence-analysis policy</h2><p>Control how automated observations enter the human workflow.</p></div><span className="version-tag">Policy v1.4</span></div><div className="governance-setting"><div><strong>Minimum recommendation confidence</strong><p>Below this threshold, Niriksh returns “Needs human review” instead of a classification.</p></div><label className="range-control"><input type="range" min="40" max="95" value={threshold} onChange={event => setThreshold(Number(event.target.value))}/><b>{threshold}%</b></label></div><ToggleSetting title="Citizen fact-check" detail="Ask complainants to verify summaries and extracted facts before submission." value={citizenCheck} setValue={setCitizenCheck}/><ToggleSetting title="Autonomous routing" detail="Allow cases to route without an officer decision. Kept off by policy." value={autoRoute} setValue={setAutoRoute} dangerous/><ToggleSetting title="Sensitive evidence previews" detail="Show intimate or child-safety evidence thumbnails by default." value={sensitivePreview} setValue={setSensitivePreview} dangerous/><div className="governance-actions"><button className="button button-primary" onClick={() => save("AI governance policy saved")}><Save size={15}/> Save policy</button></div></section>
      <aside className="governance-side"><section className="admin-panel model-card"><span><BrainCircuit size={18}/> ANALYSIS PROVIDER</span><strong>Structured multimodal adapter</strong><p>Deterministic demo provider</p><div><i/>Operational</div><small>Last contract check · 4 minutes ago</small></section><section className="admin-panel guardrail-card"><span><ShieldCheck size={18}/> ENFORCED GUARDRAILS</span>{["No legal conclusions","No guilt determination","Timestamp-linked observations","Human approval required","Original evidence immutable"].map(item => <div key={item}><Check size={13}/>{item}</div>)}</section><section className="admin-panel data-card"><Database size={19}/><div><span>RETENTION PROFILE</span><strong>Demo data · Local only</strong><small>No files transmitted externally</small></div></section></aside>
    </div>}

    {tab === "Audit log" && <section className="admin-panel audit-admin"><div className="admin-panel-head"><div><h2>System decision log</h2><p>AI outputs, citizen corrections, and human decisions remain attributable.</p></div><button>Export log</button></div><div className="audit-table"><div className="audit-head"><span>EVENT</span><span>CASE</span><span>ACTOR</span><span>TIME</span><span>INTEGRITY</span></div>{events.map((event,index) => <div className="audit-row" key={`${event.reference}-${index}`}><div><span className="audit-symbol">{event.actor.includes("Niriksh") ? <BrainCircuit/> : event.actor === "Complainant" ? <UserCheck/> : <Fingerprint/>}</span><p><strong>{event.label}</strong><small>{event.detail}</small></p></div><b>{event.reference}</b><span>{event.actor}</span><span>{event.time}</span><em><CheckCircle2/>Recorded</em></div>)}</div></section>}
  </div>;
}

function ToggleSetting({title,detail,value,setValue,dangerous=false}:{title:string;detail:string;value:boolean;setValue:(value:boolean)=>void;dangerous?:boolean}) {
  return <div className="governance-setting"><div><strong>{title}{dangerous && <em>Restricted</em>}</strong><p>{detail}</p></div><button className={`governance-toggle ${value ? "enabled" : ""} ${dangerous ? "dangerous" : ""}`} onClick={() => setValue(!value)}>{value ? <ToggleRight/> : <ToggleLeft/>}<span>{value ? "Enabled" : "Disabled"}</span></button></div>;
}
