import Link from "next/link";
import { ArrowRight, BrainCircuit, CheckCircle2, Clock3, FileCheck2, FileText, MessageCircle, PhoneCall, Route, SearchCheck, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicHeader } from "@/components/PublicHeader";

export default function Home() {
  return <div className="landing-page">
    <PublicHeader/>

    <main>
      <section className="landing-hero">
        <div className="landing-hero-copy"><span className="landing-kicker"><ShieldCheck size={17}/> India’s guided cyber complaint workspace</span><h1>Clarity and support,<br/><em>when it matters most.</em></h1><p>Register a cyber complaint, understand what the evidence may show, and follow every update from one calm, secure place.</p><div className="landing-hero-actions"><Link className="landing-primary" href="/report">Register a complaint <ArrowRight size={19}/></Link><Link className="landing-secondary" href="/track"><SearchCheck size={18}/> Track my complaint</Link></div><div className="landing-trust-row"><span><CheckCircle2/>Plain-language guidance</span><span><CheckCircle2/>Clear status updates</span><span><CheckCircle2/>Human-reviewed decisions</span></div><p style={{marginTop:16}}><Link href="/whatsapp" style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:13,fontWeight:700,color:"var(--teal-dark)"}}><MessageCircle size={16}/> Prefer a guided chat instead? Try the WhatsApp-style demo →</Link></p></div>
        <aside className="landing-preview-card"><div className="landing-preview-head"><span><FileCheck2 size={21}/></span><div><small>WHAT YOU RECEIVE</small><strong>A report you can understand</strong></div></div><div className="landing-preview-summary"><small>AT A GLANCE</small><h2>Important facts first</h2><p>Priority, possible harm and the strongest evidence indicators are shown before the longer detail.</p></div><div className="landing-preview-items"><span><i>1</i><div><strong>Plain-language summary</strong><small>What the system understood</small></div></span><span><i>2</i><div><strong>Incident timeline</strong><small>What happened and when</small></div></span><span><i>3</i><div><strong>Help and routing</strong><small>Who to contact next</small></div></span></div></aside>
      </section>

      <section className="landing-emergency" id="support"><PhoneCall size={22}/><div><strong>Are you or someone else in immediate danger?</strong><span>Call India’s emergency response number now.</span></div><a href="tel:112">Call 112</a></section>

      <section className="landing-how" id="how-it-works"><div className="landing-section-heading"><small>SIMPLE BY DESIGN</small><h2>From incident to the right jurisdiction</h2><p>Four clear stages. Analysis prepares the route; a human confirms any submission.</p></div><div className="landing-how-grid"><article><span><FileText/></span><small>STEP 1</small><h3>Tell us what happened</h3><p>Write naturally. Add the date, platform and any files or links you have.</p></article><article><span><BrainCircuit/></span><small>STEP 2</small><h3>The pipeline connects the evidence</h3><p>The complaint and supported media are combined into source-backed context, indicators and missing information.</p></article><article><span><FileCheck2/></span><small>STEP 3</small><h3>Review the report</h3><p>Check the important findings, timeline and evidence explanation before continuing.</p></article><article><span><Route/></span><small>STEP 4</small><h3>See the jurisdiction route</h3><p>See the suggested jurisdiction, primary review unit and official places to file or request help.</p></article></div></section>

      <section className="landing-assurance"><div><span><ShieldCheck/></span><small>YOUR CONTROL</small><h2>Analysis supports people. It does not replace them.</h2><p>Niriksh organises allegations and evidence for review. It does not decide whether someone is guilty or whether media is forensically authentic.</p></div><ul><li><CheckCircle2/>Important findings show their source</li><li><CheckCircle2/>Uncertainty and missing information stay visible</li><li><CheckCircle2/>Jurisdiction routing always requires human confirmation</li><li><Clock3/>The analysis pipeline runs by default and keeps its limitations visible</li></ul></section>
    </main>

    <footer className="landing-footer"><Logo/><span>Niriksh · Human-reviewed cybercrime support</span><Link href="/track">Track a complaint</Link></footer>
  </div>;
}
