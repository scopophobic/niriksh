import Link from "next/link";
import {
  AlertTriangle, ArrowDown, ArrowRight, Check, FileAudio, FileImage, FileText,
  Fingerprint, GitBranch, Link2, ListTree, MessageCircle, PhoneCall, Scale,
  SearchCheck, ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PublicHeader } from "@/components/PublicHeader";

export default function Home() {
  return <div className="landing-v3">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <PublicHeader/>
    <main id="main-content">
      <section className="story-hero">
        <div className="story-hero-copy">
          <p className="story-intro">Cybercrime complaint preparation</p>
          <h1>A complaint is not yet an investigation-ready case.</h1>
          <p className="story-deck">Niriksh turns scattered cybercrime complaints and mixed evidence into structured, source-backed case intelligence—then surfaces explicit identifiers observed in other submitted incidents.</p>
          <div className="story-actions"><Link className="story-primary" href="/report">Report an incident <ArrowRight/></Link><Link className="story-secondary" href="/whatsapp"><MessageCircle/>Use guided chat</Link><Link className="story-secondary" href="/track"><SearchCheck/>Track a complaint</Link></div>
          <p className="story-boundary"><ShieldCheck/>People make every judgement and operational decision.</p>
        </div>

        <div className="transformation" aria-label="Raw complaint material transformed into a structured case">
          <div className="raw-material">
            <span className="transformation-label">Raw complaint</span>
            <div className="raw-slip raw-message"><FileText/><span><strong>Long narrative</strong><small>“My account was taken over…”</small></span></div>
            <div className="raw-slip raw-image"><FileImage/><span><strong>Screenshot 04</strong><small>Payment request</small></span></div>
            <div className="raw-slip raw-audio"><FileAudio/><span><strong>Voice note</strong><small>Incident details</small></span></div>
          </div>
          <div className="transformation-spine"><span>Niriksh</span><ArrowRight/><ArrowDown/></div>
          <div className="case-sheet">
            <div className="case-sheet-head"><span translate="no">CYB-2026-000123</span><small>Awaiting review</small></div>
            <div className="case-sheet-summary"><small>What happened</small><strong>Account compromise followed by impersonation and payment requests.</strong></div>
            <div className="case-sheet-event"><time>09:31</time><i/><span><strong>Payment requested</strong><small><Link2/>Source → Screenshot 04</small></span></div>
            <div className="case-sheet-indicator"><Fingerprint/><span><small>Shared UPI identifier</small><strong translate="no">niriksh-demo@upi</strong></span><b>2 cases</b></div>
          </div>
        </div>
      </section>

      <section className="landing-v3-emergency" aria-label="Emergency support"><PhoneCall/><div><strong>Immediate danger or urgent financial fraud?</strong><span>Call 112 for emergency help or 1930 for the national cybercrime helpline.</span></div><a href="tel:112">Call 112</a><a href="tel:1930">Call 1930</a></section>

      <section className="three-pillars" id="how-it-works">
        <header><p>One coherent path</p><h2>Report → Understand → Connect</h2><span>Niriksh complements existing complaint and review workflows. It does not replace police or government systems.</span></header>
        <div className="pillar-sequence">
          <article><b>1</b><div><h3>Report</h3><p>Capture the incident without overwhelming the person reporting it.</p><ul><li><Check/>Narrative and structured details</li><li><Check/>Screenshots, messages, documents and supported media</li><li><Check/>Useful questions for information still missing</li></ul></div></article>
          <article><b>2</b><div><h3>Understand</h3><p>Reconstruct what happened while preserving the boundary between evidence and observation.</p><ul><li><Check/>Concise case reconstruction</li><li><Check/>Evidence-backed chronology</li><li><Check/>Source trace, active signals and explicit indicators</li></ul></div></article>
          <article><b>3</b><div><h3>Connect</h3><p>Show when an exact submitted identifier also occurs in another complaint.</p><ul><li><Check/>Deterministic database matching</li><li><Check/>The exact identifier responsible</li><li><Check/>Potential connection—not offender attribution</li></ul></div></article>
        </div>
      </section>

      <section className="evidence-story">
        <div className="evidence-story-copy"><p>Understand</p><h2>Every useful observation should have somewhere to point.</h2><span>Original evidence, extracted facts and analysis-assisted observations are displayed as different layers. When chronology is uncertain, Niriksh says so instead of inventing an exact order.</span></div>
        <div className="trace-example">
          <div><small>Finding</small><strong>₹15,000 requested</strong></div><ArrowRight/><div><small>Source</small><strong>Screenshot 04</strong></div><ArrowRight/><div><small>Original evidence</small><strong>Submitted image</strong></div>
        </div>
      </section>

      <section className="connect-story">
        <div className="connect-story-mark"><GitBranch/></div>
        <div><p>Connect</p><h2>Shared identifiers become visible. Conclusions remain human.</h2><span>Niriksh compares normalized phone numbers, emails, UPI IDs, transaction references, URLs, domains and scoped social handles in PostgreSQL. It does not connect cases because their stories merely sound alike.</span></div>
        <div className="connect-match"><span><small>Case A</small><strong translate="no">niriksh-demo@upi</strong></span><i/><span><small>Case B</small><strong translate="no">niriksh-demo@upi</strong></span><p><AlertTriangle/>A shared identifier indicates a potential connection only. It does not establish ownership, identity, guilt or offender.</p></div>
      </section>

      <section className="human-ai-boundary">
        <header><p>Trust boundary</p><h2>Assistance without automated judgement</h2></header>
        <div className="boundary-columns">
          <div><span><ListTree/>Analysis can assist with</span><ul><li>Extracting information from submitted material</li><li>Organising evidence and supported chronology</li><li>Identifying missing information</li><li>Surfacing factual active signals</li></ul></div>
          <div><span><Scale/>Analysis does not decide</span><ul><li>Guilt or evidence authenticity</li><li>Which victim deserves priority</li><li>Whether an FIR should be filed</li><li>Final legal classification or enforcement action</li></ul></div>
        </div>
      </section>

      <section className="final-invitation"><div><h2>Start with the incident. Leave with a case a person can review.</h2><p>Report what happened, attach what you safely have, and keep uncertainty visible.</p></div><Link href="/report">Report an incident <ArrowRight/></Link></section>
    </main>
    <footer className="landing-v3-footer"><Logo/><p>Niriksh is a preparation and intelligence layer for human-led cybercrime review.</p><div><Link href="/safety">Check a suspicious message</Link><Link href="/track">Track a complaint</Link></div></footer>
  </div>;
}
