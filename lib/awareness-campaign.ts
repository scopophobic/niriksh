export interface AwarenessPattern {
  id: string;
  title: string;
  status: string;
  behavioural_pattern?: string;
  complaint_count: number;
  indicators: Array<{ type_label: string; case_count: number }>;
}

export interface AwarenessScene {
  id: string;
  duration: string;
  heading: string;
  onScreen: string;
  narration: string;
}

export interface AwarenessCampaign {
  title: string;
  objective: string;
  evidenceLine: string;
  language: string;
  audience: string;
  scenes: AwarenessScene[];
}

function safeAction(title: string) {
  const value = title.toLowerCase();
  if (value.includes("investment") || value.includes("return")) {
    return "Ignore guaranteed-return claims. Verify the adviser and platform independently before sending money.";
  }
  if (value.includes("parcel") || value.includes("courier")) {
    return "Contact the courier through its official website. Do not pay a release fee through a link or chat message.";
  }
  if (value.includes("arrest") || value.includes("authority")) {
    return "End the call, speak to someone you trust, and contact the agency through a published official number.";
  }
  return "Pause, verify through a trusted channel, do not send money, and report the suspicious contact.";
}

export function buildAwarenessCampaign(pattern: AwarenessPattern, language: string, audience: string): AwarenessCampaign {
  const signalTypes = [...new Set(pattern.indicators.map(item => item.type_label))];
  const signalPhrase = signalTypes.length
    ? signalTypes.slice(0, 3).join(", ")
    : "repeated contact and payment requests";
  const behaviour = pattern.behavioural_pattern?.replaceAll("→", "followed by")
    || "An unexpected approach builds trust or urgency before asking the person to act.";

  return {
    title: `Spot the warning signs: ${pattern.title}`,
    objective: `Help ${audience.toLowerCase()} recognise this reported tactic and pause before acting.`,
    evidenceLine: `Built from one human-verified pattern supported by ${pattern.complaint_count} reports and ${signalTypes.length} recurring signal type${signalTypes.length === 1 ? "" : "s"}.`,
    language,
    audience,
    scenes: [
      {
        id: "hook",
        duration: "0–6 sec",
        heading: "Stop the scroll",
        onScreen: "A familiar message can still be a trap.",
        narration: `Reports reviewed by cybercrime officers show a recurring ${pattern.title.toLowerCase()}.`,
      },
      {
        id: "tactic",
        duration: "6–22 sec",
        heading: "Explain the tactic",
        onScreen: behaviour,
        narration: `The approach may feel convincing because it follows a sequence: ${behaviour}`,
      },
      {
        id: "signals",
        duration: "22–40 sec",
        heading: "Show warning signs",
        onScreen: `Watch for: ${signalPhrase}`,
        narration: `Look for repeated warning signs involving ${signalPhrase}. No single sign proves fraud, so pause and verify.`,
      },
      {
        id: "action",
        duration: "40–60 sec",
        heading: "Give one safe action",
        onScreen: "Pause. Verify. Protect. Report.",
        narration: `${safeAction(pattern.title)} If money was sent, contact the bank immediately and use official reporting channels.`,
      },
    ],
  };
}

export function campaignAsText(campaign: AwarenessCampaign) {
  const scenes = campaign.scenes.map(scene => [
    `${scene.duration} — ${scene.heading}`,
    `On screen: ${scene.onScreen}`,
    `Narration: ${scene.narration}`,
  ].join("\n")).join("\n\n");
  return `${campaign.title}\nAudience: ${campaign.audience}\nLanguage: ${campaign.language}\nObjective: ${campaign.objective}\nEvidence basis: ${campaign.evidenceLine}\n\n${scenes}\n\nHuman review is required before production or publication.`;
}
