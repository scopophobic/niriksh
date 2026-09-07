export interface AwarenessPattern {
  id: string;
  title: string;
  status: string;
  behavioural_pattern?: string;
  complaint_count: number;
  indicators: Array<{ type_label: string; case_count: number }>;
}

export type AwarenessFormat = "video" | "image" | "text";

export interface AwarenessScene {
  id: string;
  duration: string;
  heading: string;
  onScreen: string;
  narration: string;
}

interface AwarenessCampaignBase {
  title: string;
  objective: string;
  evidenceLine: string;
  language: string;
  audience: string;
}

export interface VideoAwarenessCampaign extends AwarenessCampaignBase {
  format: "video";
  scenes: AwarenessScene[];
}

export interface ImageAwarenessCampaign extends AwarenessCampaignBase {
  format: "image";
  image: {
    headline: string;
    body: string;
    warningSigns: string[];
    action: string;
    footer: string;
  };
}

export interface TextAwarenessCampaign extends AwarenessCampaignBase {
  format: "text";
  text: {
    headline: string;
    introduction: string;
    warningSigns: string[];
    action: string;
    closing: string;
  };
}

export type AwarenessCampaign = VideoAwarenessCampaign | ImageAwarenessCampaign | TextAwarenessCampaign;

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

function campaignFoundation(pattern: AwarenessPattern, language: string, audience: string) {
  const signalTypes = [...new Set(pattern.indicators.map(item => item.type_label))];
  const behaviour = pattern.behavioural_pattern?.replaceAll("→", "followed by")
    || "An unexpected approach builds trust or urgency before asking the person to act.";
  return {
    signalTypes,
    behaviour,
    action: safeAction(pattern.title),
    base: {
      title: `Spot the warning signs: ${pattern.title}`,
      objective: `Help ${audience.toLowerCase()} recognise this reported tactic and pause before acting.`,
      evidenceLine: `Built from one human-verified pattern supported by ${pattern.complaint_count} reports and ${signalTypes.length} recurring signal type${signalTypes.length === 1 ? "" : "s"}.`,
      language,
      audience,
    },
  };
}

export function buildAwarenessCampaign(pattern: AwarenessPattern, language: string, audience: string): VideoAwarenessCampaign;
export function buildAwarenessCampaign(pattern: AwarenessPattern, language: string, audience: string, format: "video"): VideoAwarenessCampaign;
export function buildAwarenessCampaign(pattern: AwarenessPattern, language: string, audience: string, format: "image"): ImageAwarenessCampaign;
export function buildAwarenessCampaign(pattern: AwarenessPattern, language: string, audience: string, format: "text"): TextAwarenessCampaign;
export function buildAwarenessCampaign(pattern: AwarenessPattern, language: string, audience: string, format: AwarenessFormat): AwarenessCampaign;
export function buildAwarenessCampaign(
  pattern: AwarenessPattern,
  language: string,
  audience: string,
  format: AwarenessFormat = "video",
): AwarenessCampaign {
  const { signalTypes, behaviour, action, base } = campaignFoundation(pattern, language, audience);
  const signalPhrase = signalTypes.length
    ? signalTypes.slice(0, 3).join(", ")
    : "repeated contact and payment requests";
  const warningSigns = signalTypes.length
    ? signalTypes.slice(0, 3).map(signal => `Unexpected requests involving ${signal.toLowerCase()}`)
    : ["Repeated contact", "Pressure to act quickly", "Requests for money or sensitive information"];

  if (format === "image") {
    return {
      ...base,
      format,
      image: {
        headline: `Pause before you respond to ${pattern.title.toLowerCase()}`,
        body: behaviour,
        warningSigns,
        action,
        footer: "If money was sent, contact your bank immediately and report through official channels.",
      },
    };
  }

  if (format === "text") {
    return {
      ...base,
      format,
      text: {
        headline: `Public advisory: ${pattern.title}`,
        introduction: `Cybercrime reports reviewed by officers show a recurring pattern. ${behaviour}`,
        warningSigns,
        action,
        closing: "No single sign proves fraud. Pause, verify independently, and use official reporting channels if something feels wrong.",
      },
    };
  }

  return {
    ...base,
    format,
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
        narration: `${action} If money was sent, contact the bank immediately and use official reporting channels.`,
      },
    ],
  };
}

export function campaignAsText(campaign: AwarenessCampaign) {
  const header = [
    campaign.title,
    `Format: ${campaign.format === "video" ? "Video awareness" : campaign.format === "image" ? "Image awareness" : "Text awareness"}`,
    `Audience: ${campaign.audience}`,
    `Language: ${campaign.language}`,
    `Objective: ${campaign.objective}`,
    `Evidence basis: ${campaign.evidenceLine}`,
  ].join("\n");

  let content: string;
  if (campaign.format === "video") {
    content = campaign.scenes.map(scene => [
      `${scene.duration} — ${scene.heading}`,
      `On screen: ${scene.onScreen}`,
      `Narration: ${scene.narration}`,
    ].join("\n")).join("\n\n");
  } else if (campaign.format === "image") {
    content = [
      `Headline: ${campaign.image.headline}`,
      `Body: ${campaign.image.body}`,
      `Warning signs:\n${campaign.image.warningSigns.map(item => `- ${item}`).join("\n")}`,
      `Safe action: ${campaign.image.action}`,
      `Footer: ${campaign.image.footer}`,
    ].join("\n\n");
  } else {
    content = [
      campaign.text.headline,
      campaign.text.introduction,
      `Warning signs:\n${campaign.text.warningSigns.map(item => `- ${item}`).join("\n")}`,
      `What to do: ${campaign.text.action}`,
      campaign.text.closing,
    ].join("\n\n");
  }

  return `${header}\n\n${content}\n\nHuman review is required before production or publication.`;
}
