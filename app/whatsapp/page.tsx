import { AlertTriangle, MessageCircleWarning } from "lucide-react";
import { PublicHeader } from "@/components/PublicHeader";
import { WhatsAppDemo } from "@/components/WhatsAppDemo";

export const metadata = {
  title: "Niriksh — Bhumika-derived WhatsApp reporting demo",
  description: "Try the Bhumika-derived guided reporting experience for phishing, fraud, threats, or harmful content—inside Niriksh.",
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
            <strong>This Niriksh demo is derived from Bhumika&apos;s guided WhatsApp reporting experience.</strong>
            <p>The browser simulation below uses the Bhumika-style conversational intake and Niriksh&apos;s analysis pipeline. It is not connected to Meta or a real phone number. Bhumika separately owns the live WhatsApp channel, webhook, and conversation delivery (see docs/decisions.md, ADR-046).</p>
            <p><strong>Cases filed here are real</strong> — they enter Niriksh&apos;s own database and appear on the internal dashboard — but tracking a reference back is only possible in this same browser right now, not from any device.</p>
            {!aiConfigured && (
              <p className="whatsapp-demo-notice-fixture"><AlertTriangle size={14} /> No Gemini API key is configured in this environment, so this chat is running in offline fixture mode — classification quality is materially lower than the connected version.</p>
            )}
          </div>
        </div>

        <h1>Try the Bhumika-derived reporting flow</h1>
        <p className="whatsapp-demo-sub">The first hours matter most — money&apos;s still traceable, threats are still active, harmful content is still live enough to pull down. Message Niriksh below — voice, photo, or text — and she&apos;ll walk you through exactly what a reviewer needs.</p>

        <WhatsAppDemo aiConfigured={aiConfigured} />
      </main>
    </div>
  );
}
