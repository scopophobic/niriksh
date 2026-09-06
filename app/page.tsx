import Link from "next/link";
import {
  AlertTriangle, ArrowDown, ArrowRight, Camera, Check, ClipboardCheck, FileAudio, FileImage, FileText,
  Fingerprint, GitBranch, Link2, ListTree, MessageCircle, Mic, PhoneCall, Play, Scale, Video,
  ShieldCheck,
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
          <p className="story-intro">PREVENTION-FIRST CYBER INTELLIGENCE</p>
          <h1>Every complaint should make the next one safer.</h1>
          <p className="story-deck">Niriksh turns cybercrime reports into structured intelligence, learns recurring patterns across incidents, and helps surface threats earlier—under human review.</p>
          <div className="prevention-chips"><span>Prevention-first</span><span>Learns across incidents</span><span>Human-reviewed</span><span>Source-backed</span></div>
          <div className="story-actions"><Link className="story-primary" href="/prevention">Explore prevention intelligence <ArrowRight/></Link><Link className="story-secondary" href="/report">Report an incident</Link><Link className="story-secondary" href="/whatsapp"><MessageCircle/>Try Bhumika WhatsApp demo</Link></div>
          <p className="story-boundary"><ShieldCheck/>People verify patterns and decide every operational action.</p>
        </div>

        <div className="transformation" aria-label="Raw complaint material transformed into a structured case">
          <div className="raw-material">
            <span className="transformation-label">Structured report</span>
            <div className="raw-slip raw-message"><FileText/><span><strong>Source-backed case</strong><small>Timeline and indicators</small></span></div>
            <div className="raw-slip raw-image"><FileImage/><span><strong>Screenshot 04</strong><small>Payment request</small></span></div>
            <div className="raw-slip raw-audio"><FileAudio/><span><strong>Voice note</strong><small>Incident details</small></span></div>
          </div>
          <div className="transformation-spine"><span>Learn</span><ArrowRight/><ArrowDown/></div>
          <div className="case-sheet">
            <div className="case-sheet-head"><span>EMERGING PATTERN</span><small>Requires review</small></div>
            <div className="case-sheet-summary"><small>5 related incidents</small><strong>Recurring payment identifier and domain.</strong></div>
            <div className="case-sheet-event"><time>WHY</time><i/><span><strong>Same UPI ID in 5 reports</strong><small><Link2/>Source-backed indicators</small></span></div>
            <div className="case-sheet-indicator"><Fingerprint/><span><small>Recurring domain</small><strong translate="no">wealth-demo.example</strong></span><b>5 cases</b></div>
          </div>
        </div>
      </section>

      <section className="landing-v3-emergency" aria-label="Emergency support"><PhoneCall/><div><strong>Immediate danger or urgent financial fraud?</strong><span>Call 112 for emergency help or 1930 for the national cybercrime helpline.</span></div><a href="tel:112">Call 112</a><a href="tel:1930">Call 1930</a></section>

      <section className="whatsapp-story" id="whatsapp-reporting"><div className="whatsapp-story-copy"><p>Bhumika-derived WhatsApp reporting demo</p><h2>Report in the conversation you already understand.</h2><span>Adapted from Bhumika’s guided intake experience, this Niriksh demo helps someone explain what happened without guessing which form field comes next. It checks required information as the conversation develops, asks focused follow-ups, and keeps the person in control before anything is filed.</span><Link className="story-primary" href="/whatsapp"><MessageCircle/>Open the Bhumika-derived demo <ArrowRight/></Link><small>The browser demo runs inside Niriksh. Bhumika separately owns the live Meta/WhatsApp channel.</small></div><div className="whatsapp-flow-card"><div className="whatsapp-flow-head"><MessageCircle/><div><strong>Bhumika-derived reporting assistant</strong><span>Guided intake · ready when you are</span></div><i/></div><div className="whatsapp-bubble bot">Tell me what happened in your own words. I’ll help organise the details.</div><div className="whatsapp-bubble user">A message promised guaranteed returns and asked me to pay a fee.</div><div className="whatsapp-bubble bot"><strong>Let’s check what is still needed</strong><span><Check/>What happened</span><span><Check/>Contact channel</span><span className="pending"><ClipboardCheck/>Payment identifier or link</span><span className="pending"><Camera/>Evidence, if safe to share</span></div><div className="whatsapp-flow-footer"><span><Mic/>Voice note</span><span><Camera/>Photo</span><b>Send when ready</b></div></div></section>

      <section className="three-pillars" id="how-it-works">
        <header><p>ONE PREVENTION LOOP</p><h2>Understand → Learn → Prevent</h2><span>Individual reports are often treated in isolation. Niriksh retains the case intelligence that makes recurring harm visible.</span></header>
        <div className="pillar-sequence">
          <article><b>1</b><div><h3>Understand</h3><p>Turn each incident into a structured, source-backed case.</p><ul><li><Check/>Narrative and structured details</li><li><Check/>Timeline, provenance and indicators</li><li><Check/>Useful questions for information still missing</li></ul></div></article>
          <article><b>2</b><div><h3>Learn</h3><p>Compare structured cases so repeated signals become visible.</p><ul><li><Check/>Exact shared indicators</li><li><Check/>Explainable related incidents</li><li><Check/>Emerging patterns requiring review</li></ul></div></article>
          <article><b>3</b><div><h3>Prevent</h3><p>Use human-verified intelligence to inform future review.</p><ul><li><Check/>Known-pattern warnings on new incidents</li><li><Check/>Internal watchlists and advisory drafts</li><li><Check/>Potential connection—not offender attribution</li></ul></div></article>
        </div>
      </section>

      <section className="evidence-story">
        <div className="evidence-story-copy"><p>Understand</p><h2>Every useful observation should have somewhere to point.</h2><span>Original evidence, extracted facts and analysis-assisted observations are displayed as different layers. When chronology is uncertain, Niriksh says so instead of inventing an exact order.</span></div>
        <div className="trace-example">
          <div><small>Finding</small><strong>₹15,000 requested</strong></div><ArrowRight/><div><small>Source</small><strong>Screenshot 04</strong></div><ArrowRight/><div><small>Original evidence</small><strong>Submitted image</strong></div>
        </div>
      </section>

      <section className="connect-story" id="prevention-intelligence">
        <div className="connect-story-mark"><GitBranch/></div>
        <div><p>Prevention intelligence</p><h2>Patterns make the reason visible. Conclusions remain human.</h2><span>Niriksh compares normalized phone numbers, emails, UPI IDs, transaction references, URLs, domains and scoped social handles. Exact shared identifiers create candidates; behavioural context can explain them, never prove them.</span><Link className="story-secondary" href="/prevention">Explore prevention intelligence <ArrowRight/></Link></div>
        <div className="connect-match"><span><small>5 related reports</small><strong translate="no">demo-invest@upi</strong></span><i/><span><small>Recurring domain</small><strong translate="no">wealth-demo.example</strong></span><p><AlertTriangle/>Potential connection only. A human must verify a pattern before it can support a warning or awareness draft.</p></div>
      </section>

      <section className="awareness-reel" id="awareness"><div className="awareness-reel-copy"><p>Awareness, when the intelligence is ready</p><h2>A place for simple, human-reviewed scam explainers.</h2><span>This space is reserved for short awareness videos and shareable guidance built from verified patterns—not from unreviewed AI guesses.</span><div className="awareness-reel-notes"><span><Check/>One pattern, one clear lesson</span><span><Check/>Short video or share card</span><span><Check/>Human approval before publishing</span></div></div><div className="awareness-video-placeholder"><div className="video-orbit"><span/><span/><span/><Play/></div><div><Video/><strong>Awareness video space</strong><small>Reserved for reviewed explainers</small></div><em>Coming after verification</em></div></section>

      <section className="human-ai-boundary">
        <header><p>Trust boundary</p><h2>Assistance without automated judgement</h2></header>
        <div className="boundary-columns">
          <div><span><ListTree/>Analysis can assist with</span><ul><li>Extracting information from submitted material</li><li>Organising evidence and supported chronology</li><li>Identifying missing information</li><li>Surfacing factual active signals</li></ul></div>
          <div><span><Scale/>Analysis does not decide</span><ul><li>Guilt or evidence authenticity</li><li>Which victim deserves priority</li><li>Whether an FIR should be filed</li><li>Final legal classification or enforcement action</li></ul></div>
        </div>
      </section>

      <section className="final-invitation"><div><h2>Cybercrime systems shouldn’t forget.</h2><p>Explore how incident intelligence can help prevent repeated harm.</p></div><Link href="/prevention">Explore prevention intelligence <ArrowRight/></Link></section>
    </main>
    <footer className="landing-v3-footer"><Logo/><p>Niriksh is prevention intelligence built from incident patterns, always under human review.</p><div><Link href="/safety">Check a suspicious message</Link><Link href="/track">Track a complaint</Link></div></footer>
  </div>;
}
