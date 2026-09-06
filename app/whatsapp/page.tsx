import { AlertTriangle, MessageCircleWarning } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { WhatsAppDemo } from "@/components/WhatsAppDemo";

export const metadata = {
  title: "Niriksh — WhatsApp-style guided chat",
  description: "Report phishing, fraud, threats, or harmful content to Niriksh through a guided, WhatsApp-style chat — no forms needed.",
};

export default function WhatsAppPage() {
  const aiConfigured = Boolean(process.env.GEMINI_API_KEY);

  return (
    <div className="landing-page whatsapp-demo-page">
      <PublicHeader />
      <main className="whatsapp-demo-main">
        <div className="whatsapp-demo-notice">
          <MessageCircleWarning size={20} />
          <div>
            <strong>This is a simulation of the WhatsApp experience, not a connection to WhatsApp.</strong>
            <p>No Meta integration, no phone number, nobody&apos;s real WhatsApp account is involved — the conversation below runs entirely on this page against Niriksh&apos;s own analysis. Niriksh&apos;s real WhatsApp intake path is owned separately by Bhumika and is not reflected here (see docs/decisions.md, ADR-046).</p>
            <p><strong>Cases filed here are real</strong> — they enter Niriksh&apos;s own database and appear on the internal dashboard — but tracking a reference back is only possible in this same browser right now, not from any device.</p>
            {!aiConfigured && (
              <p className="whatsapp-demo-notice-fixture"><AlertTriangle size={14} /> No Gemini API key is configured in this environment, so this chat is running in offline fixture mode — classification quality is materially lower than the connected version.</p>
            )}
          </div>
        </div>

        <h1>Report through a guided chat</h1>
        <p className="whatsapp-demo-sub">The first hours matter most — money&apos;s still traceable, threats are still active, harmful content is still live enough to pull down. Message Niriksh below — voice, photo, or text — and she&apos;ll walk you through exactly what a reviewer needs.</p>

        <WhatsAppDemo aiConfigured={aiConfigured} />
      </main>
    </div>
  );
}
