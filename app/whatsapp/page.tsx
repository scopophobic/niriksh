import { PublicHeader } from "@/components/PublicHeader";
import { WhatsAppDemo } from "@/components/WhatsAppDemo";
import { WhatsAppMark } from "@/components/WhatsAppMark";

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
        <details className="whatsapp-demo-notice">
          <summary>
            <WhatsAppMark />
            <span><strong>Bhumika WhatsApp reporting demo</strong><small>Browser preview · complaints submitted here are saved to Niriksh</small></span>
            <b>About this demo</b>
          </summary>
          <div>
            <p>This page previews Bhumika&apos;s conversational intake inside Niriksh; it is not connected to Meta or a real WhatsApp phone number. Bhumika owns the live channel and delivery integration.</p>
            <p>Complaints submitted in this demo enter the Niriksh database. Tracking is currently limited to this browser.</p>
            {!aiConfigured && <p className="whatsapp-demo-notice-fixture">Guided demo mode is active because connected AI analysis is not configured.</p>}
          </div>
        </details>

        <h1>Try the Bhumika-derived reporting flow</h1>
        <p className="whatsapp-demo-sub">The first hours matter most — money&apos;s still traceable, threats are still active, harmful content is still live enough to pull down. Message Niriksh below — voice, photo, or text — and she&apos;ll walk you through exactly what a reviewer needs.</p>

        <WhatsAppDemo aiConfigured={aiConfigured} />
      </main>
    </div>
  );
}
